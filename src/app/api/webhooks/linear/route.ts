import { NextRequest } from 'next/server';
import {
  parseBoolean,
  parseConflictPolicy,
  parseDirection,
  parseString,
  resolveSyncCredentials,
  resolveWebhookSecret,
  WebhookBody,
} from '@/lib/sync/webhook-config';
import { runSyncCycle } from '@/lib/sync/service';
import {
  consumeReplayKey,
  isTimestampFresh,
  parseTimestampMs,
  verifyHmacSha256Signature,
} from '@/lib/security/webhooks';
import { consumeRateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  buildSyncScopeKey,
  enqueueSyncJob,
  SyncJobPayload,
} from '@/lib/infra/sync-jobs';
import { isProductionModeEnabled } from '@/lib/infra/env';

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const WEBHOOK_REPLAY_TTL_MS = 10 * 60 * 1000;
const DEFAULT_LINEAR_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const WEBHOOK_RATE_LIMIT = 240;
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function parseBody(rawBody: string): WebhookBody {
  if (!rawBody.trim()) return {};
  try {
    const body = JSON.parse(rawBody);
    if (!body || typeof body !== 'object') return {};
    return body as WebhookBody;
  } catch {
    return {};
  }
}

function getLinearSignatureHeader(headers: Headers): string | null {
  return headers.get('linear-signature') ?? headers.get('x-webhook-signature');
}

function getTimestampToleranceMs(): number {
  const raw = Number.parseInt(
    process.env.GOODBYE_LINEAR_WEBHOOK_TOLERANCE_MS ?? '',
    10
  );

  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return DEFAULT_LINEAR_TIMESTAMP_TOLERANCE_MS;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const clientIp = getClientIp(request.headers);
  const rateLimit = consumeRateLimit({
    key: `linear:${clientIp}`,
    limit: WEBHOOK_RATE_LIMIT,
    windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        success: false,
        error: 'Rate limit exceeded',
      },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    return Response.json(
      {
        success: false,
        error: 'Payload too large',
      },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const body = parseBody(rawBody);
  const credentials = resolveSyncCredentials(body, request.headers);
  const webhookSecret = resolveWebhookSecret('linear');

  if (webhookSecret) {
    const signatureHeader = getLinearSignatureHeader(request.headers);
    if (!signatureHeader) {
      return Response.json(
        {
          success: false,
          error: 'Missing webhook signature header',
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const isValid = verifyHmacSha256Signature({
      secret: webhookSecret,
      payload: rawBody,
      signatureHeader,
    });

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: 'Invalid webhook signature',
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const timestampMs =
      parseTimestampMs(body.webhookTimestamp) ??
      parseTimestampMs(request.headers.get('x-webhook-timestamp'));

    if (timestampMs == null) {
      return Response.json(
        {
          success: false,
          error: 'Missing webhook timestamp for signed Linear event',
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!isTimestampFresh(timestampMs, getTimestampToleranceMs())) {
      return Response.json(
        {
          success: false,
          error: 'Stale webhook timestamp',
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const replayAccepted = consumeReplayKey(
      `linear:${signatureHeader}:${timestampMs}`,
      WEBHOOK_REPLAY_TTL_MS
    );
    if (!replayAccepted) {
      return Response.json(
        {
          success: false,
          error: 'Replay detected',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  if (!credentials.shortcutToken || !credentials.linearToken || !credentials.linearTeamId) {
    return Response.json(
      {
        success: false,
        error:
          'Missing required values: shortcut token, linear token, and linear team id. Provide headers/body or GOODBYE_* env vars.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const direction = parseDirection(request.headers.get('x-sync-direction') ?? body.direction);
  const conflictPolicy = parseConflictPolicy(
    request.headers.get('x-sync-conflict-policy') ?? body.conflictPolicy
  );
  const includeComments = parseBoolean(
    request.headers.get('x-sync-include-comments') ?? body.includeComments,
    true
  );
  const includeAttachments = parseBoolean(
    request.headers.get('x-sync-include-attachments') ?? body.includeAttachments,
    false
  );
  const shortcutTeamId =
    parseString(request.headers.get('x-shortcut-team-id')) ?? parseString(body.shortcutTeamId);

  const syncConfig: SyncJobPayload['config'] = {
    direction,
    conflictPolicy,
    shortcutTeamId,
    linearTeamId: credentials.linearTeamId,
    includeComments,
    includeAttachments,
  };

  try {
    if (isProductionModeEnabled()) {
      const payload: SyncJobPayload = {
        scopeKey: buildSyncScopeKey(syncConfig),
        shortcutToken: credentials.shortcutToken,
        linearToken: credentials.linearToken,
        config: syncConfig,
        triggerSource: 'linear',
        triggerReason: 'linear webhook',
      };

      const queueJobId = await enqueueSyncJob(payload);
      return Response.json(
        {
          success: true,
          accepted: true,
          queueJobId,
          processedAt: new Date().toISOString(),
        },
        { status: 202, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const result = await runSyncCycle({
      shortcutToken: credentials.shortcutToken,
      linearToken: credentials.linearToken,
      config: syncConfig,
      triggerSource: 'linear',
      triggerReason: 'linear webhook',
    });

    return Response.json(
      {
        success: true,
        processedAt: new Date().toISOString(),
        delta: result.delta,
        cursors: result.cursors,
        events: result.events.slice(0, 20),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET(): Promise<Response> {
  const secretConfigured = Boolean(resolveWebhookSecret('linear'));
  const productionMode = isProductionModeEnabled();
  return Response.json(
    {
      ok: true,
      route: '/api/webhooks/linear',
      requiredHeaders: secretConfigured ? [] : ['x-shortcut-token', 'x-linear-token', 'x-linear-team-id'],
      signatureHeader: 'Linear-Signature',
      secretConfigured,
      productionMode,
      supportedEnv: [
        'GOODBYE_PRODUCTION_MODE',
        'GOODBYE_POSTGRES_URL',
        'GOODBYE_REDIS_URL',
        'GOODBYE_SYNC_JOB_ATTEMPTS',
        'GOODBYE_SYNC_JOB_BACKOFF_MS',
        'GOODBYE_SHORTCUT_TOKEN',
        'GOODBYE_LINEAR_TOKEN',
        'GOODBYE_LINEAR_TEAM_ID',
        'GOODBYE_LINEAR_WEBHOOK_SECRET',
        'GOODBYE_WEBHOOK_SHARED_SECRET',
        'GOODBYE_LINEAR_WEBHOOK_TOLERANCE_MS',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

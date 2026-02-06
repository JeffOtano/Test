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
import { consumeReplayKey, verifyHmacSha256Signature } from '@/lib/security/webhooks';
import { consumeRateLimit, getClientIp } from '@/lib/security/rate-limit';

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const WEBHOOK_REPLAY_TTL_MS = 10 * 60 * 1000;
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

function getShortcutSignatureHeader(headers: Headers): string | null {
  return (
    headers.get('payload-signature') ??
    headers.get('shortcut-signature') ??
    headers.get('x-webhook-signature')
  );
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const clientIp = getClientIp(request.headers);
  const rateLimit = consumeRateLimit({
    key: `shortcut:${clientIp}`,
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
  const webhookSecret = resolveWebhookSecret('shortcut');

  if (webhookSecret) {
    const signatureHeader = getShortcutSignatureHeader(request.headers);
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

    const replayAccepted = consumeReplayKey(
      `shortcut:${signatureHeader}`,
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

  try {
    const result = await runSyncCycle({
      shortcutToken: credentials.shortcutToken,
      linearToken: credentials.linearToken,
      config: {
        direction,
        conflictPolicy,
        shortcutTeamId,
        linearTeamId: credentials.linearTeamId,
        includeComments,
        includeAttachments,
      },
      triggerSource: 'shortcut',
      triggerReason: 'shortcut webhook',
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
  const secretConfigured = Boolean(resolveWebhookSecret('shortcut'));
  return Response.json(
    {
      ok: true,
      route: '/api/webhooks/shortcut',
      requiredHeaders: secretConfigured ? [] : ['x-shortcut-token', 'x-linear-token', 'x-linear-team-id'],
      signatureHeader: 'Payload-Signature',
      secretConfigured,
      supportedEnv: [
        'GOODBYE_SHORTCUT_TOKEN',
        'GOODBYE_LINEAR_TOKEN',
        'GOODBYE_LINEAR_TEAM_ID',
        'GOODBYE_SHORTCUT_WEBHOOK_SECRET',
        'GOODBYE_WEBHOOK_SHARED_SECRET',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

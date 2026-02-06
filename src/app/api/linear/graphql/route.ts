import { NextRequest } from 'next/server';
import { normalizeLinearApiKey } from '@/lib/security/tokens';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const LINEAR_PROXY_TIMEOUT_MS = 30_000;

function buildLinearHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    Accept: request.headers.get('accept') ?? 'application/json',
  };

  const authorization =
    request.headers.get('authorization') ?? request.headers.get('x-linear-token');
  if (authorization) {
    headers.Authorization = normalizeLinearApiKey(authorization);
  }

  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
}

async function proxyLinear(request: NextRequest): Promise<Response> {
  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINEAR_PROXY_TIMEOUT_MS);
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(LINEAR_GRAPHQL_URL, {
      method,
      headers: buildLinearHeaders(request),
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return Response.json(
        { error: 'Linear API request timed out' },
        { status: 504, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return Response.json(
      { error: 'Failed to reach Linear API' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  } finally {
    clearTimeout(timeout);
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = ['content-type', 'x-request-id'];
  passthroughHeaders.forEach((headerName) => {
    const headerValue = upstreamResponse.headers.get(headerName);
    if (headerValue) {
      responseHeaders.set(headerName, headerValue);
    }
  });
  responseHeaders.set('Cache-Control', 'no-store');

  const responseBody = await upstreamResponse.arrayBuffer();

  return new Response(responseBody, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  return proxyLinear(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxyLinear(request);
}

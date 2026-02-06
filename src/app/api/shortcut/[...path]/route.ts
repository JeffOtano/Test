import { NextRequest } from 'next/server';

const SHORTCUT_API_BASE = 'https://api.app.shortcut.com/api/v3';
const SHORTCUT_PROXY_TIMEOUT_MS = 30_000;

function buildShortcutUrl(pathSegments: string[], search: string): string {
  const path = pathSegments.join('/');
  return `${SHORTCUT_API_BASE}/${path}${search}`;
}

function buildProxyHeaders(
  request: NextRequest,
  shortcutToken: string
): HeadersInit {
  const headers: Record<string, string> = {
    'Shortcut-Token': shortcutToken,
    Accept: request.headers.get('accept') ?? 'application/json',
  };

  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
}

async function proxyShortcut(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;
  const token =
    request.headers.get('x-shortcut-token') ??
    request.headers.get('shortcut-token') ??
    '';

  if (!token) {
    return Response.json(
      { error: 'Missing Shortcut token' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const upstreamUrl = buildShortcutUrl(path, request.nextUrl.search);
  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHORTCUT_PROXY_TIMEOUT_MS);
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: buildProxyHeaders(request, token),
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return Response.json(
        { error: 'Shortcut API request timed out' },
        { status: 504, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return Response.json(
      { error: 'Failed to reach Shortcut API' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  } finally {
    clearTimeout(timeout);
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    'content-type',
    'request-key',
    'x-rate-limit-remaining',
    'x-rate-limit-reset',
    'retry-after',
  ];

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  return proxyShortcut(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  return proxyShortcut(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  return proxyShortcut(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  return proxyShortcut(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  return proxyShortcut(request, context);
}

import { NextRequest } from 'next/server';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

function buildLinearHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    Accept: request.headers.get('accept') ?? 'application/json',
  };

  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers.Authorization = authorization;
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

  const upstreamResponse = await fetch(LINEAR_GRAPHQL_URL, {
    method,
    headers: buildLinearHeaders(request),
    body,
    cache: 'no-store',
  });

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

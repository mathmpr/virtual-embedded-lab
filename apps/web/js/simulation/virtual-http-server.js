export function createVirtualHttpServer(config = {}) {
  const routes = [
    ...routesFromConfig(config),
    ...jsonPlaceholderRoutes()
  ];

  return {
    canRespond(request) {
      const parsed = parseHttpRequest(request);
      return Boolean(parsed && parsed.complete);
    },
    respond({ host, port, request }) {
      const parsed = parseHttpRequest(request);
      const normalizedHost = normalizeHost(host);

      if (!parsed) {
        return httpResponse(400, 'Bad Request', { error: 'Invalid HTTP request' });
      }

      const route = routes.find((item) => {
        return routeHostMatches(item.host, normalizedHost)
          && routeMethodMatches(item.method, parsed.method)
          && item.path === parsed.path;
      });

      if (!route && parsed.method === 'OPTIONS') {
        return optionsResponse(routes, normalizedHost, parsed.path);
      }

      if (!route) {
        return httpResponse(404, 'Not Found', {
          error: 'No virtual HTTP route',
          host: normalizedHost,
          port,
          method: parsed.method,
          path: parsed.path,
          query: parsed.query
        });
      }

      const response = typeof route.response === 'function'
        ? route.response(parsed)
        : route.response;

      return buildHttpResponse(response, parsed);
    }
  };
}

export function parseHttpRequest(request) {
  const separator = request.includes('\r\n\r\n') ? '\r\n\r\n' : request.includes('\n\n') ? '\n\n' : null;

  if (!separator) {
    return null;
  }

  const [head, ...bodyParts] = request.split(separator);
  const lines = head.split(/\r?\n/);
  const [method, target, protocol] = (lines.shift() ?? '').trim().split(/\s+/);

  if (!method || !target || !/^HTTP\/1\.[01]$/.test(protocol ?? '')) {
    return null;
  }

  const headers = parseHttpHeaders(lines);
  const url = new URL(target, 'http://virtual-lab.local');
  const rawBody = bodyParts.join(separator);
  const chunked = headerValues(headers, 'transfer-encoding').some((value) => value.toLowerCase() === 'chunked');
  const decodedChunked = chunked ? decodeChunkedBody(rawBody) : null;
  const contentLength = Math.max(0, Number(headerValue(headers, 'content-length') ?? 0) || 0);
  const body = chunked ? decodedChunked.body : rawBody;

  return {
    method: method.toUpperCase(),
    target,
    protocol,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    queryEntries: [...url.searchParams.entries()],
    headers,
    rawBody,
    body,
    chunked,
    contentLength: chunked ? body.length : contentLength,
    complete: chunked ? decodedChunked.complete : rawBody.length >= contentLength
  };
}

export function httpResponse(statusCode, reason, body = '', headers = {}) {
  const normalizedBody = typeof body === 'string' ? body : JSON.stringify(body);
  const normalizedHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': normalizedBody.length,
    Connection: 'close',
    ...headers
  };

  return [
    `HTTP/1.1 ${statusCode} ${reason}`,
    ...Object.entries(normalizedHeaders).map(([name, value]) => `${name}: ${value}`),
    '',
    normalizedBody
  ].join('\r\n');
}

function parseHttpHeaders(lines) {
  const headers = new Map();

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex < 0) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    const existing = headers.get(name);

    headers.set(name, existing ? [...existing, value] : [value]);
  }

  return headers;
}

function headerValue(headers, name) {
  return headers.get(String(name).toLowerCase())?.[0] ?? null;
}

function headerValues(headers, name) {
  return headers.get(String(name).toLowerCase()) ?? [];
}

function buildHttpResponse(response, request) {
  if (typeof response === 'string') {
    return response;
  }

  if (response.statusCode === 204) {
    return [
      `HTTP/1.1 204 ${response.reason ?? 'No Content'}`,
      ...Object.entries(response.headers ?? {}).map(([name, value]) => `${name}: ${value}`),
      'Content-Length: 0',
      'Connection: close',
      '',
      ''
    ].join('\r\n');
  }

  return httpResponse(
    response.statusCode ?? 200,
    response.reason ?? 'OK',
    request.method === 'HEAD' ? '' : bodyForResponse(response, request),
    response.headers ?? {}
  );
}

function bodyForResponse(response, request) {
  if (typeof response.body === 'function') {
    return response.body(request);
  }

  return response.body ?? {};
}

function routesFromConfig(config = {}) {
  return Object.entries(config.hosts ?? {}).flatMap(([host, hostConfig]) => {
    return (hostConfig.routes ?? []).map((route) => ({
      host,
      method: String(route.method ?? 'GET').toUpperCase(),
      path: route.path ?? '/',
      response: {
        statusCode: route.statusCode ?? route.response?.statusCode ?? 200,
        reason: route.reason ?? route.response?.reason ?? 'OK',
        headers: route.headers ?? route.response?.headers ?? {},
        body: route.body ?? route.response?.body ?? {}
      }
    }));
  });
}

function jsonPlaceholderRoutes() {
  return [
    {
      host: 'jsonplaceholder.typicode.com',
      method: 'GET',
      path: '/todos/1',
      response(request) {
        const response = {
          userId: 1,
          id: 1,
          title: request.query.title ?? 'delectus aut autem',
          completed: request.query.completed === 'true' ? true : false
        };

        if (Object.keys(request.query).length > 0) {
          response.query = request.query;
        }

        return { statusCode: 200, reason: 'OK', body: response };
      }
    },
    {
      host: 'jsonplaceholder.typicode.com',
      method: 'POST',
      path: '/todos',
      response(request) {
        return {
          statusCode: 201,
          reason: 'Created',
          body: {
            id: 201,
            received: request.body,
            query: request.query
          }
        };
      }
    },
    ...['PUT', 'PATCH'].map((method) => ({
      host: 'jsonplaceholder.typicode.com',
      method,
      path: '/todos/1',
      response(request) {
        return {
          statusCode: 200,
          reason: 'OK',
          body: {
            id: 1,
            method,
            received: request.body,
            query: request.query
          }
        };
      }
    })),
    {
      host: 'jsonplaceholder.typicode.com',
      method: 'DELETE',
      path: '/todos/1',
      response(request) {
        return {
          statusCode: 200,
          reason: 'OK',
          body: {
            id: 1,
            deleted: true,
            query: request.query
          }
        };
      }
    },
    {
      host: 'jsonplaceholder.typicode.com',
      method: 'OPTIONS',
      path: '/todos/1',
      response: {
        statusCode: 204,
        reason: 'No Content',
        headers: {
          Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    }
  ];
}

function routeHostMatches(routeHost, host) {
  return normalizeHost(routeHost) === host;
}

function routeMethodMatches(routeMethod, requestMethod) {
  return routeMethod === requestMethod || (requestMethod === 'HEAD' && routeMethod === 'GET');
}

function optionsResponse(routes, host, path) {
  const methods = routes
    .filter((route) => routeHostMatches(route.host, host) && route.path === path)
    .map((route) => route.method);
  const allowed = [...new Set([...methods, methods.includes('GET') ? 'HEAD' : null, 'OPTIONS'].filter(Boolean))].join(', ');

  if (!allowed) {
    return httpResponse(404, 'Not Found', {
      error: 'No virtual HTTP route',
      host,
      method: 'OPTIONS',
      path
    });
  }

  return [
    'HTTP/1.1 204 No Content',
    `Allow: ${allowed}`,
    `Access-Control-Allow-Methods: ${allowed}`,
    'Access-Control-Allow-Headers: Content-Type',
    'Content-Length: 0',
    'Connection: close',
    '',
    ''
  ].join('\r\n');
}

function decodeChunkedBody(rawBody) {
  let index = 0;
  let body = '';

  while (index < rawBody.length) {
    const lineEnd = rawBody.indexOf('\r\n', index);

    if (lineEnd < 0) {
      return { complete: false, body };
    }

    const size = Number.parseInt(rawBody.slice(index, lineEnd).split(';', 1)[0], 16);

    if (!Number.isFinite(size)) {
      return { complete: false, body };
    }

    index = lineEnd + 2;

    if (size === 0) {
      return { complete: rawBody.slice(index).startsWith('\r\n'), body };
    }

    if (rawBody.length < index + size + 2) {
      return { complete: false, body };
    }

    body += rawBody.slice(index, index + size);
    index += size + 2;
  }

  return { complete: false, body };
}

function normalizeHost(host) {
  return String(host ?? '').trim().toLowerCase();
}

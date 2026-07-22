import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { compileFirmwareIrWithClang } from './firmware/clang-analyzer.mjs';
import { compileFirmwareWasmWithClang } from './firmware/wasm-compiler.mjs';
import { handleMqttBridgeRequest } from './network/mqtt-bridge.mjs';

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const root = process.cwd();
const webRoot = join(root, 'apps', 'web');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8']
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (url.pathname === '/api/firmware/analyze') {
      try {
        await handleFirmwareAnalysis(request, response);
      } catch (error) {
        response.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8'
        });
        response.end(JSON.stringify({
          available: false,
          ok: false,
          diagnostics: [
            {
              source: 'server',
              severity: 'error',
              code: 'FIRMWARE_ANALYSIS_FAILED',
              message: error.message
            }
          ]
        }));
      }
      return;
    }

    if (url.pathname === '/api/firmware/compile-wasm') {
      try {
        await handleFirmwareWasmCompile(request, response);
      } catch (error) {
        response.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8'
        });
        response.end(JSON.stringify({
          available: false,
          ok: false,
          diagnostics: [
            {
              source: 'server',
              severity: 'error',
              code: 'FIRMWARE_WASM_COMPILE_FAILED',
              message: error.message
            }
          ],
          wasmBase64: null
        }));
      }
      return;
    }

    if (url.pathname === '/api/components') {
      await handleComponentsCatalog(response);
      return;
    }

    if (url.pathname === '/api/examples') {
      await handleExamplesCatalog(response);
      return;
    }

    if (url.pathname.startsWith('/api/examples/')) {
      await handleExampleProject(url.pathname, response);
      return;
    }

    if (url.pathname.startsWith('/api/network/mqtt/')) {
      await handleMqttBridgeRequest(url.pathname, request, response);
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const base = pathname.startsWith('/examples/') || pathname.startsWith('/node_modules/') ? root : webRoot;
    const filePath = normalize(join(base, pathname));

    if (!filePath.startsWith(base)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

async function handleFirmwareAnalysis(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' });
    response.end('Method not allowed');
    return;
  }

  const payload = JSON.parse(await readRequestBody(request, 256 * 1024));
  const result = await compileFirmwareIrWithClang(String(payload.code ?? ''));

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(result));
}

async function handleFirmwareWasmCompile(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' });
    response.end('Method not allowed');
    return;
  }

  const payload = JSON.parse(await readRequestBody(request, 256 * 1024));
  const result = await compileFirmwareWasmWithClang(String(payload.code ?? ''), {
    constants: typeof payload.constants === 'object' && payload.constants !== null ? payload.constants : {}
  });

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(result));
}

async function handleComponentsCatalog(response) {
  const componentsRoot = join(root, 'components', 'official');
  const manifests = await readOfficialComponentManifests(componentsRoot);

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify({
    schemaVersion: '1.0.0',
    components: manifests
  }));
}

async function handleExamplesCatalog(response) {
  const examplesRoot = join(root, 'examples');
  const entries = await readdir(examplesRoot, { withFileTypes: true });
  const examples = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const project = await readExampleProject(entry.name);
    examples.push({
      id: entry.name,
      name: project.name,
      componentCount: project.components?.length ?? 0
    });
  }

  examples.sort((left, right) => left.name.localeCompare(right.name));

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify({
    schemaVersion: '1.0.0',
    examples
  }));
}

async function handleExampleProject(pathname, response) {
  const exampleId = decodeURIComponent(pathname.slice('/api/examples/'.length));

  if (!/^[a-z0-9][a-z0-9-]*$/i.test(exampleId)) {
    response.writeHead(400);
    response.end('Invalid example id');
    return;
  }

  const project = await readExampleProject(exampleId);

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(project));
}

async function readExampleProject(exampleId) {
  return JSON.parse(await readFile(join(root, 'examples', exampleId, 'project.json'), 'utf8'));
}

async function readOfficialComponentManifests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const manifests = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      manifests.push(...await readOfficialComponentManifests(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name === 'component.json') {
      manifests.push(JSON.parse(await readFile(entryPath, 'utf8')));
    }
  }

  return manifests.sort((left, right) => left.identity.id.localeCompare(right.identity.id));
}

function readRequestBody(request, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

server.listen(port, host, () => {
  console.log(`Virtual Embedded Lab web UI: http://${host}:${port}`);
});

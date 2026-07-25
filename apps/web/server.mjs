import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { compileFirmwareIrWithClang } from './firmware/clang-analyzer.mjs';
import {
  enqueueFirmwareWasmCompile,
  getFirmwareWasmCompileJob
} from './firmware/wasm-compile-queue.mjs';
import { handleMqttBridgeRequest } from './network/mqtt-bridge.mjs';
import { readProjectWithCodeReferences } from './project-code-references.mjs';

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const root = process.cwd();
const webRoot = join(root, 'apps', 'web');
const sharedProjectsRoot = join(root, 'shared');

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

    if (url.pathname.startsWith('/api/firmware/compile-wasm/')) {
      await handleFirmwareWasmCompileStatus(url.pathname, response);
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

    if (url.pathname === '/api/shared-projects') {
      try {
        await handleSharedProjectCreate(request, response);
      } catch (error) {
        sendSharedProjectError(response, error);
      }
      return;
    }

    if (url.pathname.startsWith('/api/shared-projects/')) {
      try {
        await handleSharedProject(url.pathname, request, response);
      } catch (error) {
        sendSharedProjectError(response, error);
      }
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

    const pathname = url.pathname === '/' || isSharedProjectPath(url.pathname) ? '/index.html' : url.pathname;
    const base = pathname.startsWith('/examples/')
      || pathname.startsWith('/node_modules/')
      || pathname.startsWith('/components/')
      || pathname.startsWith('/apps/')
      ? root
      : webRoot;
    const filePath = normalize(join(base, pathname));

    if (!isInsideBase(filePath, base)) {
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
  const job = enqueueFirmwareWasmCompile({
    code: String(payload.code ?? ''),
    constants: typeof payload.constants === 'object' && payload.constants !== null ? payload.constants : {}
  });

  response.writeHead(202, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify({
    ...job,
    message: 'Estamos compilando seu codigo e ele sera executado em alguns instantes.'
  }));
}

async function handleFirmwareWasmCompileStatus(pathname, response) {
  const jobId = decodeURIComponent(pathname.slice('/api/firmware/compile-wasm/'.length));
  const job = /^[a-f0-9-]{36}$/i.test(jobId)
    ? getFirmwareWasmCompileJob(jobId)
    : null;

  if (!job) {
    response.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify({
      status: 'missing',
      result: null
    }));
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(job));
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
  const componentsRoot = join(root, 'components', 'official');
  const entries = await readdir(examplesRoot, { withFileTypes: true });
  const manifests = await readOfficialComponentManifests(componentsRoot);
  const componentsById = new Map(manifests.map((manifest) => [manifest.identity.id, manifest]));
  const examples = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const project = await readExampleProject(entry.name);
    const componentNames = componentNamesForProject(project, componentsById);
    const boardNames = boardNamesForProject(project, componentsById);

    examples.push({
      id: entry.name,
      name: project.name,
      description: project.description ?? '',
      descriptionI18n: project.descriptionI18n ?? null,
      boardNames,
      boardGroup: boardGroupName(boardNames),
      componentCount: project.components?.length ?? 0,
      components: componentNames
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

function componentNamesForProject(project, componentsById) {
  const names = (project.components ?? []).map((component) => {
    return componentsById.get(component.componentId)?.identity?.name ?? component.componentId;
  });

  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

function boardNamesForProject(project, componentsById) {
  const names = (project.components ?? [])
    .filter((component) => component.componentId?.startsWith('board.'))
    .map((component) => componentsById.get(component.componentId)?.identity?.name ?? component.componentId);

  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

function boardGroupName(boardNames) {
  if (boardNames.length === 0) {
    return 'No board';
  }

  if (boardNames.length > 1) {
    return 'Multiple boards';
  }

  return boardNames[0];
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

async function handleSharedProjectCreate(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' });
    response.end('Method not allowed');
    return;
  }

  const payload = JSON.parse(await readRequestBody(request, 1024 * 1024));
  const shareKey = createShareKey();
  const project = normalizeSharedProjectPayload(payload, shareKey);

  await writeSharedProject(shareKey, project);
  sendSharedProjectResponse(response, 201, shareKey, project);
}

async function handleSharedProject(pathname, request, response) {
  const shareKey = decodeURIComponent(pathname.slice('/api/shared-projects/'.length));

  if (!isShareKey(shareKey)) {
    response.writeHead(400);
    response.end('Invalid shared project id');
    return;
  }

  if (request.method === 'GET') {
    const project = await readSharedProject(shareKey);

    if (!project) {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      response.end(JSON.stringify({ error: 'SHARED_PROJECT_NOT_FOUND' }));
      return;
    }

    sendSharedProjectResponse(response, 200, shareKey, project);
    return;
  }

  if (request.method === 'PUT') {
    const payload = JSON.parse(await readRequestBody(request, 1024 * 1024));
    const project = normalizeSharedProjectPayload(payload, shareKey);

    await writeSharedProject(shareKey, project);
    sendSharedProjectResponse(response, 200, shareKey, project);
    return;
  }

  response.writeHead(405, { Allow: 'GET, PUT' });
  response.end('Method not allowed');
}

function normalizeSharedProjectPayload(payload, shareKey) {
  const project = payload?.project && typeof payload.project === 'object'
    ? payload.project
    : payload;

  if (!project || typeof project !== 'object') {
    throw new Error('Shared project payload must be an object.');
  }

  if (!Array.isArray(project.components) || !Array.isArray(project.connections) || !project.code?.files) {
    throw new Error('Shared project payload is not a valid project.');
  }

  return {
    ...project,
    schemaVersion: project.schemaVersion ?? '1.0.0',
    shareKey
  };
}

async function readSharedProject(shareKey) {
  try {
    return JSON.parse(await readFile(sharedProjectFile(shareKey), 'utf8'));
  } catch {
    return null;
  }
}

async function writeSharedProject(shareKey, project) {
  const directory = sharedProjectDirectory(shareKey);

  await mkdir(directory, { recursive: true });
  await writeFile(sharedProjectFile(shareKey), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
}

function sendSharedProjectResponse(response, statusCode, shareKey, project) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify({
    shareKey,
    url: `/?shared=${shareKey}`,
    project
  }));
}

function sendSharedProjectError(response, error) {
  const statusCode = error instanceof SyntaxError || /payload|project/i.test(error.message) ? 400 : 500;

  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify({
    error: statusCode === 400 ? 'INVALID_SHARED_PROJECT' : 'SHARED_PROJECT_FAILED',
    message: error.message
  }));
}

function createShareKey() {
  return randomBytes(16).toString('hex');
}

function isShareKey(value) {
  return /^[a-f0-9]{32}$/.test(value);
}

function isSharedProjectPath(pathname) {
  return /^\/[a-f0-9]{32}$/.test(pathname);
}

function sharedProjectDirectory(shareKey) {
  return join(sharedProjectsRoot, shareKey);
}

function sharedProjectFile(shareKey) {
  return join(sharedProjectDirectory(shareKey), 'project.json');
}

async function readExampleProject(exampleId) {
  return readProjectWithCodeReferences(join(root, 'examples', exampleId, 'project.json'));
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
      const manifest = JSON.parse(await readFile(entryPath, 'utf8'));
      const componentDirectory = normalize(join(entryPath, '..')).replaceAll('\\', '/');
      const relativeDirectory = componentDirectory.slice(root.replaceAll('\\', '/').length).replace(/^\/+/, '');

      manifests.push({
        ...manifest,
        resources: {
          ...(manifest.resources ?? {}),
          baseUrl: `/${relativeDirectory}/`
        }
      });
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

function isInsideBase(filePath, base) {
  const normalizedBase = normalize(base);
  return filePath === normalizedBase || filePath.startsWith(`${normalizedBase}/`);
}

server.listen(port, host, () => {
  console.log(`Virtual Embedded Lab web UI: http://${host}:${port}`);
});

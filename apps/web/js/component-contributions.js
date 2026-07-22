let installedManifests = [];
const loadedModulesByKind = new Map();

export function installComponentContributionManifests(manifests) {
  installedManifests = manifests;
  loadedModulesByKind.clear();
}

export async function loadComponentContributionModules(kind) {
  if (loadedModulesByKind.has(kind)) {
    return loadedModulesByKind.get(kind);
  }

  const manifests = await componentContributionManifests();
  const modules = [];
  const loadedUrls = new Set();

  for (const manifest of manifests) {
    const entries = contributionModuleEntries(manifest, kind);

    for (const entry of entries) {
      const moduleUrl = contributionModuleUrl(manifest, entry);

      if (!moduleUrl) {
        continue;
      }

      if (loadedUrls.has(moduleUrl)) {
        continue;
      }

      loadedUrls.add(moduleUrl);
      modules.push(await import(moduleUrl));
    }
  }

  loadedModulesByKind.set(kind, modules);
  return modules;
}

export async function registerComponentContributions(kind, registry, context = {}) {
  const modules = await loadComponentContributionModules(kind);
  registerLoadedComponentContributions(kind, registry, context, modules);
}

export function registerLoadedComponentContributions(kind, registry, context = {}, modules = loadedModulesByKind.get(kind) ?? []) {

  for (const module of modules) {
    if (typeof module.register === 'function') {
      module.register(registry, context);
    }
  }
}

export function installComponentStyles(document) {
  if (!document) {
    return;
  }

  for (const manifest of installedManifests) {
    for (const href of contributionStyleEntries(manifest)) {
      const styleUrl = contributionModuleUrl(manifest, href);

      if (!styleUrl || document.querySelector(`link[data-component-style="${styleUrl}"]`)) {
        continue;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = styleUrl;
      link.dataset.componentStyle = styleUrl;
      document.head.append(link);
    }
  }
}

function contributionModuleEntries(manifest, kind) {
  const contribution = manifest.contributions?.[kind];

  if (!contribution) {
    return [];
  }

  if (Array.isArray(contribution.modules)) {
    return contribution.modules;
  }

  if (typeof contribution.module === 'string') {
    return [contribution.module];
  }

  return [];
}

function contributionStyleEntries(manifest) {
  const contribution = manifest.contributions?.styles;

  if (!contribution) {
    return [];
  }

  if (Array.isArray(contribution.files)) {
    return contribution.files;
  }

  if (typeof contribution.file === 'string') {
    return [contribution.file];
  }

  return [];
}

function contributionModuleUrl(manifest, entry) {
  const baseUrl = manifest.resources?.baseUrl;

  if (!baseUrl || typeof entry !== 'string') {
    return null;
  }

  return new URL(entry, globalThis.location ? new URL(baseUrl, globalThis.location.origin) : baseUrl).href;
}

async function componentContributionManifests() {
  if (installedManifests.length > 0 || !isNodeRuntime()) {
    return installedManifests;
  }

  const [{ readdir, readFile }, { dirname, join }, { fileURLToPath, pathToFileURL }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
    import('node:url')
  ]);
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const root = join(moduleDir, '..', '..', '..');
  const componentsRoot = join(root, 'components', 'official');

  installedManifests = await readNodeComponentManifests({ readdir, readFile, pathToFileURL, directory: componentsRoot });
  return installedManifests;
}

async function readNodeComponentManifests({ readdir, readFile, pathToFileURL, directory }) {
  const entries = await readdir(directory, { withFileTypes: true });
  const manifests = [];

  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      manifests.push(...await readNodeComponentManifests({ readdir, readFile, pathToFileURL, directory: path }));
      continue;
    }

    if (entry.isFile() && entry.name === 'component.json') {
      const manifest = JSON.parse(await readFile(path, 'utf8'));
      manifests.push({
        ...manifest,
        resources: {
          ...(manifest.resources ?? {}),
          baseUrl: pathToFileURL(`${directory}/`).href
        }
      });
    }
  }

  return manifests;
}

function isNodeRuntime() {
  return Boolean(globalThis.process?.versions?.node);
}

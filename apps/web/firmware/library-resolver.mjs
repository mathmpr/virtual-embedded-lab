import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(moduleDir, '..', '..', '..');
const coreLibrariesPath = join(moduleDir, 'core-libraries.json');
const officialComponentsRoot = join(workspaceRoot, 'components', 'official');
const coreLibrariesCatalog = JSON.parse(readFileSync(coreLibrariesPath, 'utf8'));

export const firmwareLibraries = [
  ...coreLibrariesCatalog.libraries,
  ...readComponentFirmwareLibraries(officialComponentsRoot)
];

export function resolveFirmwareLibraries(code, { alwaysIncludeCore = true } = {}) {
  const source = normalizeFirmwareSource(code);
  const included = new Set(readIncludeNames(source));

  return firmwareLibraries.filter((library) => {
    if (alwaysIncludeCore && library.id === 'arduino-core') {
      return true;
    }

    return library.headers.some((header) => included.has(header))
      || library.identifiers.some((identifier) => referencesIdentifier(source, identifier));
  });
}

export function resolveFirmwareLibraryBundle(code, options = {}) {
  const libraries = resolveFirmwareLibraries(code, options);

  return {
    libraries,
    imports: importsForLibraries(libraries),
    headers: headersForLibraries(libraries),
    supportedLibraries: supportedFirmwareLibraryDocs()
  };
}

export function importsForLibraries(libraries) {
  return [...new Set(libraries.flatMap((library) => library.imports))];
}

export function headersForLibraries(libraries = firmwareLibraries) {
  return [...new Set(libraries.flatMap((library) => library.headers).concat('Arduino'))];
}

export function stripResolvedFirmwareIncludes(code, libraries = firmwareLibraries) {
  const headers = new Set(headersForLibraries(libraries));
  return code.replace(/^\s*#include\s+[<"]([^>"]+)\.h[>"].*$/gm, (line, header) => {
    return headers.has(header) ? '' : line;
  });
}

export function supportedFirmwareLibraryDocs() {
  return firmwareLibraries.map((library) => ({
    id: library.id,
    headers: [...library.headers],
    apis: [...library.apis],
    imports: [...library.imports]
  }));
}

export function readIncludeNames(code) {
  return [...normalizeFirmwareSource(code).matchAll(/^\s*#include\s+[<"]([^>"]+)\.h[>"].*$/gm)].map((match) => match[1]);
}

export function normalizeFirmwareSource(code) {
  return code.includes('\n') ? code : code.replaceAll('\\n', '\n');
}

function referencesIdentifier(code, identifier) {
  return new RegExp(`\\b${identifier}\\b`).test(code);
}

function readComponentFirmwareLibraries(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return readComponentFirmwareLibraries(path);
      }

      if (!entry.isFile() || !entry.name.endsWith('.json') || !path.includes('/firmware/')) {
        return [];
      }

      return [JSON.parse(readFileSync(path, 'utf8'))];
    });
}

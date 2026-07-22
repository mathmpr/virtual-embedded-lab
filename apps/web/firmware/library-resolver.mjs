import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(moduleDir, 'libraries', 'index.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

export const firmwareLibraries = catalog.libraries;

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

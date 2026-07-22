import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(moduleDir, '..', '..', '..');
const arduinoShimRoot = join(moduleDir, 'shims', 'arduino-wasm');
const officialComponentsRoot = join(workspaceRoot, 'components', 'official');

function shimFragmentPaths(directory) {
  return readdirSync(directory)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        return shimFragmentPaths(path);
      }
      return entry.endsWith('.cpp') ? [path] : [];
    });
}

function componentShimFragmentPaths(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return componentShimFragmentPaths(path);
      }

      return entry.isFile() && entry.name.endsWith('.cpp') && path.includes('/firmware/shims/') ? [path] : [];
    });
}

const arduinoShimTemplate = [
  ...shimFragmentPaths(arduinoShimRoot),
  ...componentShimFragmentPaths(officialComponentsRoot)
]
  .map((path) => readFileSync(path, 'utf8').trimEnd())
  .join('\n\n');

export function arduinoWasmShimSource(constants = {}) {
  const ledBuiltin = Number.isInteger(constants.LED_BUILTIN) ? constants.LED_BUILTIN : 13;
  return arduinoShimTemplate.replaceAll('__VL_LED_BUILTIN__', String(ledBuiltin));
}

export function arduinoAnalyzerShimSource() {
  return arduinoWasmShimSource({ LED_BUILTIN: 13 });
}

export function arduinoAnalyzerShimLineOffset() {
  return arduinoAnalyzerShimSource().split('\n').length;
}

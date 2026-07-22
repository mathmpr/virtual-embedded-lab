import {
  importsForLibraries,
  resolveFirmwareLibraries,
  stripResolvedFirmwareIncludes,
  supportedFirmwareLibraryDocs
} from './library-resolver.mjs';

export function resolveWasmShimLibraries(code) {
  return resolveFirmwareLibraries(code);
}

export function wasmShimImportsForLibraries(libraries) {
  return importsForLibraries(libraries);
}

export function stripRegisteredFirmwareIncludes(code, libraries) {
  return stripResolvedFirmwareIncludes(code, libraries);
}

export function supportedWasmLibraryDocs() {
  return supportedFirmwareLibraryDocs();
}

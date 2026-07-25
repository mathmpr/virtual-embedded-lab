import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export async function readProjectWithCodeReferences(projectPath) {
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  return resolveProjectCodeReferences(project, dirname(projectPath), readTextFile);
}

export function readProjectWithCodeReferencesSync(projectPath) {
  const project = JSON.parse(readFileSync(projectPath, 'utf8'));
  return resolveProjectCodeReferencesSync(project, dirname(projectPath), readTextFileSync);
}

export async function resolveProjectCodeReferences(project, projectDirectory) {
  const resolved = structuredClone(project);

  resolved.code = await resolveFirmwareCodeBlock(resolved.code, projectDirectory);

  if (resolved.firmwares && typeof resolved.firmwares === 'object') {
    resolved.firmwares = Object.fromEntries(await Promise.all(
      Object.entries(resolved.firmwares).map(async ([componentId, firmware]) => [
        componentId,
        await resolveFirmwareCodeBlock(firmware, projectDirectory)
      ])
    ));
  }

  return resolved;
}

export function resolveProjectCodeReferencesSync(project, projectDirectory) {
  const resolved = structuredClone(project);

  resolved.code = resolveFirmwareCodeBlockSync(resolved.code, projectDirectory);

  if (resolved.firmwares && typeof resolved.firmwares === 'object') {
    resolved.firmwares = Object.fromEntries(
      Object.entries(resolved.firmwares).map(([componentId, firmware]) => [
        componentId,
        resolveFirmwareCodeBlockSync(firmware, projectDirectory)
      ])
    );
  }

  return resolved;
}

async function resolveFirmwareCodeBlock(firmware, projectDirectory) {
  if (!firmware?.files || typeof firmware.files !== 'object') {
    return firmware;
  }

  return {
    ...firmware,
    files: Object.fromEntries(await Promise.all(
      Object.entries(firmware.files).map(async ([name, source]) => [
        name,
        await resolveCodeFileValue(source, projectDirectory)
      ])
    ))
  };
}

function resolveFirmwareCodeBlockSync(firmware, projectDirectory) {
  if (!firmware?.files || typeof firmware.files !== 'object') {
    return firmware;
  }

  return {
    ...firmware,
    files: Object.fromEntries(
      Object.entries(firmware.files).map(([name, source]) => [
        name,
        resolveCodeFileValueSync(source, projectDirectory)
      ])
    )
  };
}

async function resolveCodeFileValue(source, projectDirectory) {
  if (typeof source === 'string') {
    return source;
  }

  if (isCodeFileReference(source)) {
    return readTextFile(resolveSafeProjectPath(projectDirectory, source.path));
  }

  return '';
}

function resolveCodeFileValueSync(source, projectDirectory) {
  if (typeof source === 'string') {
    return source;
  }

  if (isCodeFileReference(source)) {
    return readTextFileSync(resolveSafeProjectPath(projectDirectory, source.path));
  }

  return '';
}

function isCodeFileReference(value) {
  return value && typeof value === 'object' && typeof value.path === 'string';
}

function resolveSafeProjectPath(projectDirectory, path) {
  if (isAbsolute(path)) {
    throw new Error(`Code file path must be relative to the project: ${path}`);
  }

  const resolvedProjectDirectory = resolve(projectDirectory);
  const resolvedPath = resolve(resolvedProjectDirectory, path);
  const relativePath = relative(resolvedProjectDirectory, resolvedPath);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Code file path escapes the project directory: ${path}`);
  }

  return resolvedPath;
}

function readTextFile(path) {
  return readFile(path, 'utf8');
}

function readTextFileSync(path) {
  return readFileSync(path, 'utf8');
}

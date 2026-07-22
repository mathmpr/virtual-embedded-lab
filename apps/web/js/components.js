import { localizeComponentDefinition } from './i18n.js';
import { installComponentContributionManifests } from './component-contributions.js';

export const storageKey = 'virtual-embedded-lab.project';

export const componentDefinitions = {};
export const componentIdByType = {};
export const typeByComponentId = {};
export const componentPalette = [];

let installedManifests = [];

export async function loadOfficialComponents(fetchImpl = fetch) {
  const response = await fetchImpl('/api/components');

  if (!response.ok) {
    throw new Error(`Falha ao carregar componentes oficiais: HTTP ${response.status}`);
  }

  const catalog = await response.json();
  installComponentCatalog(catalog.components ?? []);
}

export function installComponentCatalog(manifests, { remember = true } = {}) {
  if (remember) {
    installedManifests = manifests;
    installComponentContributionManifests(manifests);
  }

  clearObject(componentDefinitions);
  clearObject(componentIdByType);
  clearObject(typeByComponentId);
  componentPalette.length = 0;

  for (const manifest of manifests) {
    const definition = componentDefinitionFromManifest(manifest);

    if (!definition) {
      continue;
    }

    componentDefinitions[definition.type] = definition;
    componentIdByType[definition.type] = manifest.identity.id;
    typeByComponentId[manifest.identity.id] = definition.type;

    if (definition.palette) {
      componentPalette.push({
        ...definition.palette,
        type: definition.type,
        title: definition.palette.title ?? definition.title
      });
    }
  }

  componentPalette.sort((left, right) => {
    return (left.order ?? 1000) - (right.order ?? 1000) || left.title.localeCompare(right.title);
  });
}

export function relocalizeComponentCatalog() {
  installComponentCatalog(installedManifests, { remember: false });
}

export function componentDefinitionFromManifest(manifest) {
  const visual = manifest.visual;

  if (!visual?.type) {
    return null;
  }

  const terminalById = new Map((manifest.terminals ?? []).map((terminal) => [terminal.id, terminal]));

  return localizeComponentDefinition({
    type: visual.type,
    title: visual.title ?? manifest.identity.name,
    className: visual.className ?? visual.type,
    body: visual.body ?? manifest.identity.name,
    width: visual.width ?? 140,
    height: visual.height ?? 104,
    controls: visual.controls ?? [],
    properties: defaultProperties(manifest.properties),
    propertySchema: manifest.properties ?? {},
    variants: manifest.variants ?? {},
    identity: manifest.identity,
    simulation: manifest.simulation ?? { kind: 'visual-only', effects: [], implemented: false },
    electricalModel: manifest.electricalModel ?? null,
    electricalPrimitive: manifest.electricalModel?.primitive ?? null,
    behavior: manifest.behavior ?? {},
    pinMap: manifest.behavior?.pinMap ?? {},
    palette: visual.palette ?? null,
    stateBindings: visual.stateBindings ?? [],
    terminals: (visual.terminals ?? []).map((terminal) => {
      const manifestTerminal = terminalById.get(terminal.id);

      return {
        id: terminal.id,
        label: terminal.label ?? manifestTerminal?.label ?? terminal.id,
        side: terminal.side,
        x: terminal.x,
        y: terminal.y,
        kind: terminal.kind ?? terminalKindFromManifestType(manifestTerminal?.type)
      };
    })
  });
}

function defaultProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, property]) => [key, property.default])
  );
}

function terminalKindFromManifestType(type = '') {
  if (type.includes('ground')) {
    return 'ground';
  }

  if (type.includes('power')) {
    return 'power';
  }

  if (type.includes('environment')) {
    return 'environment';
  }

  return 'signal';
}

function clearObject(object) {
  for (const key of Object.keys(object)) {
    delete object[key];
  }
}

export function terminalReference(terminal) {
  return `${terminal.componentId}.${terminal.terminalId}`;
}

export function parseTerminalReference(reference) {
  const separatorIndex = reference.lastIndexOf('.');

  if (separatorIndex <= 0 || separatorIndex === reference.length - 1) {
    throw new Error(`Referencia de terminal invalida: ${reference}`);
  }

  return {
    componentId: reference.slice(0, separatorIndex),
    terminalId: reference.slice(separatorIndex + 1)
  };
}

export function nextCounterFromIds(ids) {
  return ids.reduce((next, id) => {
    const match = id.match(/-(\d+)$/);
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'virtual-embedded-lab-project';
}

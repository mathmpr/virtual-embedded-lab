export interface Point {
  x: number;
  y: number;
}

export interface ProjectBoard {
  width: number;
  height: number;
  gridSize: number;
}

export interface ComponentInstance {
  id: string;
  componentId: string;
  position: Point;
  properties: Record<string, unknown>;
}

export type TerminalReference = `${string}.${string}`;

export interface NetConnection {
  id: string;
  terminals: TerminalReference[];
}

export interface EnvironmentConnection {
  source: TerminalReference;
  target: TerminalReference;
}

export interface ProjectCode {
  language: 'arduino-cpp';
  entry: string;
  files: Record<string, string>;
}

export interface VirtualLabProject {
  schemaVersion: string;
  name: string;
  board: ProjectBoard;
  components: ComponentInstance[];
  connections: NetConnection[];
  environmentConnections: EnvironmentConnection[];
  code: ProjectCode;
}

export type TerminalKind =
  | 'passive'
  | 'ground-capable'
  | 'power-input'
  | 'digital-input'
  | 'digital-output'
  | 'ground'
  | 'power-output'
  | 'environment-output';

export interface ComponentTerminal {
  id: string;
  label: string;
  type: TerminalKind | string;
}

export interface ComponentIdentity {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
}

export interface ComponentManifest {
  schemaVersion: string;
  identity: ComponentIdentity;
  properties?: Record<string, unknown>;
  terminals: ComponentTerminal[];
  power?: Record<string, unknown>;
  environmentInputs?: Record<string, unknown>[];
  electricalModel?: Record<string, unknown>;
  behavior?: Record<string, unknown>;
  visual?: Record<string, unknown>;
  visualBehavior?: Record<string, unknown>;
}

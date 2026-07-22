import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const defaultTimeoutMs = 5000;

export async function analyzeFirmwareWithClang(code, options = {}) {
  const clangCommand = options.command ?? process.env.CLANGXX ?? process.env.CLANG_PATH ?? 'clang++';
  const workDir = await mkdtemp(join(tmpdir(), 'virtual-lab-clang-'));
  const sourcePath = join(workDir, 'main.ino.cpp');

  try {
    await writeFile(sourcePath, arduinoShim(code), 'utf8');
    const result = await runClang(clangCommand, [
      '-fsyntax-only',
      '-x',
      'c++',
      '-std=c++17',
      sourcePath
    ], options.timeoutMs ?? defaultTimeoutMs);

    return {
      available: true,
      ok: result.exitCode === 0,
      diagnostics: parseClangDiagnostics(result.stderr, sourcePath)
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        available: false,
        ok: false,
        diagnostics: [
          {
            source: 'clang',
            severity: 'warning',
            code: 'CLANG_UNAVAILABLE',
            message: `Clang nao encontrado (${clangCommand}). Instale clang++ ou defina CLANGXX.`
          }
        ]
      };
    }

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function compileFirmwareIrWithClang(code, options = {}) {
  const clangCommand = options.command ?? process.env.CLANGXX ?? process.env.CLANG_PATH ?? 'clang++';
  const workDir = await mkdtemp(join(tmpdir(), 'virtual-lab-clang-ir-'));
  const sourcePath = join(workDir, 'main.ino.cpp');

  try {
    await writeFile(sourcePath, arduinoShim(code), 'utf8');
    const result = await runClang(clangCommand, [
      '-fsyntax-only',
      '-x',
      'c++',
      '-std=c++17',
      '-Xclang',
      '-ast-dump=json',
      sourcePath
    ], options.timeoutMs ?? defaultTimeoutMs);
    const diagnostics = parseClangDiagnostics(result.stderr, sourcePath);

    return {
      available: true,
      ok: result.exitCode === 0,
      diagnostics,
      program: result.exitCode === 0 ? withInferredFirmwareConstants(clangAstToFirmwareProgram(JSON.parse(result.stdout)), code) : null
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        available: false,
        ok: false,
        diagnostics: [
          {
            source: 'clang',
            severity: 'warning',
            code: 'CLANG_UNAVAILABLE',
            message: `Clang nao encontrado (${clangCommand}). Instale clang++ ou defina CLANGXX.`
          }
        ],
        program: null
      };
    }

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function runClang(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = '';
    let stdout = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Clang excedeu timeout de ${timeoutMs} ms.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function parseClangDiagnostics(stderr, sourcePath) {
  const diagnostics = [];
  const pattern = new RegExp(`${escapeRegExp(sourcePath)}:(\\d+):(\\d+):\\s+(warning|error|note):\\s+(.+)`);

  for (const line of stderr.split('\n')) {
    const match = pattern.exec(line);

    if (!match) {
      continue;
    }

    diagnostics.push({
      source: 'clang',
      severity: match[3],
      code: `CLANG_${match[3].toUpperCase()}`,
      line: Math.max(1, Number(match[1]) - shimLineOffset()),
      column: Number(match[2]),
      message: match[4]
    });
  }

  return diagnostics;
}

function clangAstToFirmwareProgram(ast) {
  const constants = readTopLevelConstants(ast);

  return {
    source: 'clang-ast',
    constants,
    pins: {
      trigger: constants.TRIGGER_PIN,
      echo: constants.ECHO_PIN,
      led: constants.LED_PIN
    },
    setup: functionStatements(ast, 'setup'),
    loop: functionStatements(ast, 'loop')
  };
}

function readTopLevelConstants(ast) {
  const constants = {};

  for (const node of ast.inner ?? []) {
    if (node.kind !== 'VarDecl' || !node.name || !node.type?.qualType?.includes('const')) {
      continue;
    }

    const expression = expressionFromAst(firstSemanticChild(node));

    if (expression?.type === 'literal') {
      constants[node.name] = expression.value;
    }
  }

  return constants;
}

function functionStatements(ast, name) {
  const declaration = findNode(ast, (node) => node.kind === 'FunctionDecl' && node.name === name);
  const body = declaration?.inner?.find((node) => node.kind === 'CompoundStmt');

  return statementsFromCompound(body);
}

function statementsFromCompound(compound) {
  return (compound?.inner ?? [])
    .map(statementFromAst)
    .filter(Boolean);
}

function statementFromAst(node) {
  if (node.kind === 'CallExpr' || node.kind === 'CXXMemberCallExpr') {
    return callStatementFromAst(node);
  }

  if (node.kind === 'DeclStmt') {
    const declaration = (node.inner ?? []).find((item) => item.kind === 'VarDecl');
    const expression = expressionFromAst(firstSemanticChild(declaration));

    if (!declaration?.name || !expression) {
      return null;
    }

    return {
      type: 'assign',
      target: declaration.name,
      expression
    };
  }

  if (node.kind === 'BinaryOperator' && node.opcode === '=') {
    return {
      type: 'assign',
      target: expressionFromAst(node.inner?.[0])?.name,
      expression: expressionFromAst(node.inner?.[1])
    };
  }

  if (node.kind === 'IfStmt') {
    const [condition, thenBranch, elseBranch] = node.inner ?? [];

    return {
      type: 'if',
      condition: expressionFromAst(condition),
      then: statementsFromCompound(thenBranch),
      else: statementsFromCompound(elseBranch)
    };
  }

  return null;
}

function callStatementFromAst(node) {
  const call = callExpressionFromAst(node);

  return call ? {
    type: 'call',
    name: call.name,
    args: call.args
  } : null;
}

function expressionFromAst(node) {
  const semantic = unwrapAst(node);

  if (!semantic) {
    return null;
  }

  if (semantic.kind === 'IntegerLiteral' || semantic.kind === 'FloatingLiteral') {
    return {
      type: 'literal',
      value: Number(semantic.value)
    };
  }

  if (semantic.kind === 'StringLiteral') {
    return {
      type: 'literal',
      value: parseStringLiteral(semantic.value ?? '')
    };
  }

  if (semantic.kind === 'DeclRefExpr') {
    return {
      type: 'identifier',
      name: semantic.referencedDecl?.name ?? semantic.name
    };
  }

  if (semantic.kind === 'BinaryOperator') {
    return {
      type: 'binary',
      operator: semantic.opcode,
      left: expressionFromAst(semantic.inner?.[0]),
      right: expressionFromAst(semantic.inner?.[1])
    };
  }

  if (semantic.kind === 'CallExpr' || semantic.kind === 'CXXMemberCallExpr') {
    return callExpressionFromAst(semantic);
  }

  return null;
}

function callExpressionFromAst(node) {
  const [callee, ...args] = node.inner ?? [];
  const calleeRef = unwrapAst(callee);
  const name = callName(calleeRef);

  if (!name) {
    return null;
  }

  return {
    type: 'call',
    name,
    args: args.map(expressionFromAst).filter(Boolean)
  };
}

function callName(callee) {
  if (callee?.kind === 'MemberExpr') {
    const receiver = unwrapAst(callee.inner?.[0]);
    const receiverName = receiver?.referencedDecl?.name ?? receiver?.name;
    return receiverName ? `${receiverName}.${callee.name}` : callee.name;
  }

  return callee?.referencedDecl?.name ?? callee?.name;
}

function parseStringLiteral(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^"|"$/g, '');
  }
}

function unwrapAst(node) {
  let current = node;

  while (current && [
    'ImplicitCastExpr',
    'CStyleCastExpr',
    'CXXFunctionalCastExpr',
    'ParenExpr'
  ].includes(current.kind)) {
    current = current.inner?.[0];
  }

  return current;
}

function firstSemanticChild(node) {
  return node?.inner?.find((child) => child.kind !== 'FullComment');
}

function findNode(node, predicate) {
  if (!node) {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  for (const child of node.inner ?? []) {
    const found = findNode(child, predicate);

    if (found) {
      return found;
    }
  }

  return null;
}

function arduinoShim(code) {
  const source = normalizeFirmwareSource(code);
  return `${shimSource()}\n${inferredAliasSource(source)}${stripArduinoIncludes(source)}\n`;
}

function shimSource() {
  return `using uint8_t = unsigned char;
using uint16_t = unsigned short;
using uint32_t = unsigned int;
using int32_t = int;

const int LOW = 0;
const int HIGH = 1;
const int INPUT = 0;
const int OUTPUT = 1;
const int LED_BUILTIN = 13;
const int WIFI_STA = 1;
const int WIFI_AP = 2;
const int WIFI_AP_STA = 3;
const int WL_IDLE_STATUS = 0;
const int WL_NO_SSID_AVAIL = 1;
const int WL_SCAN_COMPLETED = 2;
const int WL_CONNECTED = 3;
const int WL_CONNECT_FAILED = 4;
const int WL_CONNECTION_LOST = 5;
const int WL_DISCONNECTED = 6;

void pinMode(int, int);
void digitalWrite(int, int);
int digitalRead(int);
unsigned long pulseIn(int, int, unsigned long = 1000000);
unsigned long millis();
unsigned long micros();
void delay(unsigned long);
void delayMicroseconds(unsigned int);

class HardwareSerial {
public:
  void begin(unsigned long);
  void print(const char *);
  void print(char);
  void print(int);
  void print(long);
  void print(unsigned long);
  void print(float);
  void print(double);
  void println();
  void println(const char *);
  void println(char);
  void println(int);
  void println(long);
  void println(unsigned long);
  void println(float);
  void println(double);
  void write(int);
  int available();
  int read();
};

extern HardwareSerial Serial;

class WiFiClass {
public:
  void mode(int);
  int begin(const char *);
  int begin(const char *, const char *);
  int status();
  bool softAP(const char *);
  bool softAP(const char *, const char *);
  int scanNetworks();
  int RSSI();
  int RSSI(const char *);
  bool internetAvailable();
};

extern WiFiClass WiFi;
`;
}

function shimLineOffset() {
  return shimSource().split('\n').length;
}

function stripArduinoIncludes(code) {
  return code.replace(/^\s*#include\s+[<"](?:Arduino|WiFi)\.h[>"].*$/gm, '');
}

function normalizeFirmwareSource(code) {
  return code.includes('\n') ? code : code.replaceAll('\\n', '\n');
}

function inferredAliasSource(code) {
  return ['LED_PIN', 'PIN']
    .filter((alias) => referencesIdentifier(code, alias) && !declaresIdentifier(code, alias))
    .map((alias) => `const int ${alias} = 13;`)
    .join('\n')
    .concat('\n');
}

function withInferredFirmwareConstants(program, code) {
  if (!program) {
    return program;
  }

  const source = normalizeFirmwareSource(code);
  const inferredConstants = {};

  for (const alias of ['LED_PIN', 'PIN']) {
    if (referencesIdentifier(source, alias) && !declaresIdentifier(source, alias)) {
      inferredConstants[alias] = true;
    }
  }

  return {
    ...program,
    inferredConstants
  };
}

function referencesIdentifier(code, identifier) {
  return new RegExp(`\\b${identifier}\\b`).test(code);
}

function declaresIdentifier(code, identifier) {
  return new RegExp(`(?:const\\s+int|#define)\\s+${identifier}\\b`).test(code);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

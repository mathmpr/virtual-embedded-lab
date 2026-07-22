import { wifiStatusCodes } from './arduino-runtime.js';

// Deprecated JS IR firmware engine.
// The web UI executes firmware through WASM. Keep this module for legacy tests
// and analyzer compatibility only; implement new firmware APIs in the WASM shim.
export const legacyIrFirmwareEngine = {
  status: 'deprecated',
  purpose: 'fallback-debug-temporary',
  allowNewComponentDependencies: false,
  replacement: 'wasm'
};

const declarationPattern = /^(?:const\s+)?(?:(?:unsigned\s+)?long|float|double|int|bool|char|String)\s*(?:\*)?\s+/;

export function compileArduinoFirmware(code) {
  const diagnostics = [];
  const constants = readConstants(code);
  constants.LED_BUILTIN ??= 13;
  const inferredConstants = inferFirmwareConstants(code, constants);
  const setupBody = readFunctionBody(code, 'setup');
  const loopBody = readFunctionBody(code, 'loop');

  if (setupBody === null) {
    diagnostics.push(firmwareDiagnostic('error', 'FIRMWARE_SETUP_MISSING', 'Funcao setup() nao encontrada.'));
  }

  if (loopBody === null) {
    diagnostics.push(firmwareDiagnostic('error', 'FIRMWARE_LOOP_MISSING', 'Funcao loop() nao encontrada.'));
  }

  const program = {
    constants,
    inferredConstants,
    pins: {
      trigger: constants.TRIGGER_PIN,
      echo: constants.ECHO_PIN,
      led: constants.LED_PIN
    },
    setup: setupBody === null ? [] : parseStatements(setupBody, diagnostics),
    loop: loopBody === null ? [] : parseStatements(loopBody, diagnostics)
  };

  for (const [name, value] of Object.entries(program.pins)) {
    if (!referencesPinConstant(code, pinConstantName(name))) {
      continue;
    }

    if (!Number.isInteger(value)) {
      diagnostics.push(firmwareDiagnostic('error', 'FIRMWARE_PIN_CONSTANT_MISSING', `Constante ${pinConstantName(name)} nao encontrada.`));
    }
  }

  return {
    program,
    diagnostics
  };
}

export function runArduinoFirmware(runtime, program, options = {}) {
  const loopIterations = Math.max(1, Number(options.loopIterations ?? 1));
  const context = {
    variables: { ...program.constants },
    checkpoints: []
  };

  executeStatements(runtime, program.setup, context, 'setup');
  checkpoint(context, 'after-setup', runtime, program);

  for (let iteration = 0; iteration < loopIterations; iteration += 1) {
    executeStatements(runtime, program.loop, context, 'loop');
    checkpoint(context, `after-loop-${iteration + 1}`, runtime, program);
  }

  checkpoint(context, 'after-loop', runtime, program);

  const echoDuration = Number(context.variables.echoDuration ?? 0);
  const distanceCm = Number(context.variables.distanceCm ?? (echoDuration > 0 ? echoDuration / 58 : 0));
  const ledValue = Number.isInteger(program.pins.led) ? runtime.getPin(program.pins.led).value : 'LOW';

  return {
    echoDuration,
    distanceCm,
    ledValue,
    variables: { ...context.variables },
    checkpoints: context.checkpoints,
    pinStates: runtime.getPinsSnapshot(),
    pinEvents: runtime.getPinEventsSnapshot(),
    wifi: runtime.getWifiSnapshot()
  };
}

export function firmwareDiagnostic(severity, code, message) {
  return {
    source: 'firmware',
    severity,
    code,
    message
  };
}

function readConstants(code) {
  const constants = {};
  const constPattern = /(?:const\s+int|#define)\s+([A-Z][A-Z0-9_]*)\s*(?:=\s*)?(-?\d+)/g;
  let match = constPattern.exec(code);

  while (match) {
    constants[match[1]] = Number(match[2]);
    match = constPattern.exec(code);
  }

  return constants;
}

function inferFirmwareConstants(code, constants) {
  const inferred = {};

  for (const alias of ['LED_PIN', 'PIN']) {
    if (referencesPinConstant(code, alias) && !Number.isInteger(constants[alias])) {
      constants[alias] = constants.LED_BUILTIN;
      inferred[alias] = true;
    }
  }

  return inferred;
}

function readFunctionBody(code, name) {
  const match = new RegExp(`\\bvoid\\s+${name}\\s*\\(\\s*\\)\\s*\\{`).exec(code);

  if (!match) {
    return null;
  }

  const bodyStart = match.index + match[0].length;
  const bodyEnd = findMatchingBrace(code, bodyStart - 1);

  return bodyEnd === -1 ? null : code.slice(bodyStart, bodyEnd);
}

function findMatchingBrace(code, openBraceIndex) {
  let depth = 0;

  for (let index = openBraceIndex; index < code.length; index += 1) {
    if (code[index] === '{') {
      depth += 1;
    } else if (code[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseStatements(body, diagnostics) {
  const statements = [];
  let index = 0;

  while (index < body.length) {
    index = skipWhitespace(body, index);

    if (index >= body.length) {
      break;
    }

    if (body.startsWith('if', index) && isBoundary(body[index + 2])) {
      const parsed = parseIfStatement(body, index, diagnostics);
      statements.push(parsed.statement);
      index = parsed.nextIndex;
      continue;
    }

    const statementEnd = body.indexOf(';', index);

    if (statementEnd === -1) {
      diagnostics.push(firmwareDiagnostic('warning', 'FIRMWARE_STATEMENT_IGNORED', `Trecho nao suportado ignorado: ${body.slice(index).trim()}`));
      break;
    }

    const statement = parseSimpleStatement(body.slice(index, statementEnd).trim(), diagnostics);
    if (statement) {
      statements.push(statement);
    }
    index = statementEnd + 1;
  }

  return statements;
}

function parseIfStatement(body, startIndex, diagnostics) {
  const conditionStart = body.indexOf('(', startIndex);
  const conditionEnd = findMatchingParen(body, conditionStart);
  const thenStart = body.indexOf('{', conditionEnd);
  const thenEnd = findMatchingBrace(body, thenStart);
  const condition = body.slice(conditionStart + 1, conditionEnd).trim();
  let nextIndex = thenEnd + 1;
  let elseStatements = [];

  nextIndex = skipWhitespace(body, nextIndex);

  if (body.startsWith('else', nextIndex)) {
    const elseStart = body.indexOf('{', nextIndex);
    const elseEnd = findMatchingBrace(body, elseStart);
    elseStatements = parseStatements(body.slice(elseStart + 1, elseEnd), diagnostics);
    nextIndex = elseEnd + 1;
  }

  return {
    statement: {
      type: 'if',
      condition: parseExpression(condition),
      then: parseStatements(body.slice(thenStart + 1, thenEnd), diagnostics),
      else: elseStatements
    },
    nextIndex
  };
}

function parseSimpleStatement(source, diagnostics) {
  const statement = source.replace(declarationPattern, '').trim();
  const assignment = splitTopLevelAssignment(statement);

  if (assignment) {
    return {
      type: 'assign',
      target: assignment.target,
      expression: parseExpression(assignment.expression)
    };
  }

  const call = parseCall(statement);

  if (call) {
    return {
      type: 'call',
      name: call.name,
      args: call.args.map(parseExpression)
    };
  }

  diagnostics.push(firmwareDiagnostic('warning', 'FIRMWARE_STATEMENT_IGNORED', `Comando nao suportado ignorado: ${source}`));
  return null;
}

function splitTopLevelAssignment(statement) {
  let depth = 0;

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === '=' && depth === 0 && statement[index - 1] !== '!' && statement[index - 1] !== '<' && statement[index - 1] !== '>' && statement[index + 1] !== '=') {
      return {
        target: statement.slice(0, index).trim(),
        expression: statement.slice(index + 1).trim()
      };
    }
  }

  return null;
}

function parseExpression(source) {
  return new ExpressionParser(tokenize(source)).parse();
}

function tokenize(source) {
  const tokens = [];
  const pattern = /\s*("(?:\\.|[^"])*"|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_.]*|&&|\|\||==|!=|<=|>=|[()+\-*/<>,])\s*/g;
  let match = pattern.exec(source);

  while (match) {
    tokens.push(match[1]);
    match = pattern.exec(source);
  }

  return tokens;
}

class ExpressionParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parse() {
    return this.parseBinary(0);
  }

  parseBinary(minPrecedence) {
    let left = this.parsePrimary();

    while (this.index < this.tokens.length) {
      const operator = this.tokens[this.index];
      const precedence = operatorPrecedence(operator);

      if (precedence < minPrecedence) {
        break;
      }

      this.index += 1;
      const right = this.parseBinary(precedence + 1);
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  parsePrimary() {
    const token = this.tokens[this.index];
    this.index += 1;

    if (token === '(') {
      const expression = this.parseBinary(0);
      this.index += this.tokens[this.index] === ')' ? 1 : 0;
      return expression;
    }

    if (/^\d/.test(token)) {
      return { type: 'literal', value: Number(token) };
    }

    if (token?.startsWith('"')) {
      return { type: 'literal', value: JSON.parse(token) };
    }

    if (this.tokens[this.index] === '(') {
      this.index += 1;
      const args = [];

      while (this.index < this.tokens.length && this.tokens[this.index] !== ')') {
        args.push(this.parseBinary(0));
        if (this.tokens[this.index] === ',') {
          this.index += 1;
        }
      }

      this.index += this.tokens[this.index] === ')' ? 1 : 0;
      return { type: 'call', name: token, args };
    }

    return { type: 'identifier', name: token };
  }
}

function operatorPrecedence(operator) {
  return {
    '||': 1,
    '&&': 2,
    '==': 3,
    '!=': 3,
    '<': 4,
    '<=': 4,
    '>': 4,
    '>=': 4,
    '+': 5,
    '-': 5,
    '*': 6,
    '/': 6
  }[operator] ?? -1;
}

function executeStatements(runtime, statements, context, phase) {
  for (const statement of statements) {
    executeStatement(runtime, statement, context);
    checkpoint(context, phase, runtime);
  }
}

function executeStatement(runtime, statement, context) {
  if (statement.type === 'assign') {
    context.variables[statement.target] = evaluateExpression(runtime, statement.expression, context);
    return;
  }

  if (statement.type === 'call') {
    executeCall(runtime, statement.name, statement.args.map((arg) => evaluateExpression(runtime, arg, context)));
    return;
  }

  if (statement.type === 'if') {
    const branch = evaluateExpression(runtime, statement.condition, context) ? statement.then : statement.else;
    executeStatements(runtime, branch, context, 'if');
  }
}

function evaluateExpression(runtime, expression, context) {
  if (expression.type === 'literal') {
    return expression.value;
  }

  if (expression.type === 'identifier') {
    return readIdentifier(expression.name, context);
  }

  if (expression.type === 'call') {
    return executeCall(runtime, expression.name, expression.args.map((arg) => evaluateExpression(runtime, arg, context)));
  }

  const left = evaluateExpression(runtime, expression.left, context);
  const right = evaluateExpression(runtime, expression.right, context);

  return applyOperator(expression.operator, left, right);
}

function readIdentifier(name, context) {
  if (name === 'HIGH' || name === 'LOW' || name === 'INPUT' || name === 'OUTPUT') {
    return name;
  }

  if (name === 'WIFI_STA') {
    return 1;
  }

  if (name === 'WIFI_AP') {
    return 2;
  }

  if (name === 'WIFI_AP_STA') {
    return 3;
  }

  if (name in wifiStatusCodes) {
    return wifiStatusCodes[name];
  }

  return context.variables[name] ?? 0;
}

function executeCall(runtime, name, args) {
  if (name === 'Serial.begin') {
    runtime.serialBegin(Number(args[0]));
    return undefined;
  }

  if (name === 'Serial.print') {
    runtime.serialPrint(args[0] ?? '');
    return undefined;
  }

  if (name === 'Serial.println') {
    runtime.serialPrint(args[0] ?? '', true);
    return undefined;
  }

  if (name === 'Serial.write') {
    runtime.serialWrite(args[0] ?? 0);
    return undefined;
  }

  if (name === 'Serial.available') {
    return runtime.serialAvailable();
  }

  if (name === 'Serial.read') {
    return runtime.serialRead();
  }

  if (name === 'WiFi.mode') {
    runtime.wifiMode(args[0]);
    return undefined;
  }

  if (name === 'WiFi.begin') {
    return runtime.wifiBegin(args[0], args[1]);
  }

  if (name === 'WiFi.status') {
    return runtime.wifiStatus();
  }

  if (name === 'WiFi.softAP') {
    return runtime.wifiSoftAp(args[0], args[1]);
  }

  if (name === 'WiFi.scanNetworks') {
    return runtime.wifiScanNetworks();
  }

  if (name === 'WiFi.RSSI') {
    return runtime.wifiRssi();
  }

  if (name === 'pinMode') {
    runtime.pinMode(Number(args[0]), String(args[1]));
    return undefined;
  }

  if (name === 'digitalWrite') {
    runtime.digitalWrite(Number(args[0]), String(args[1]));
    return undefined;
  }

  if (name === 'digitalRead') {
    return runtime.digitalRead(Number(args[0]));
  }

  if (name === 'delayMicroseconds') {
    runtime.delayMicroseconds(Number(args[0]));
    return undefined;
  }

  if (name === 'delay') {
    runtime.delay(Number(args[0]));
    return undefined;
  }

  if (name === 'pulseIn') {
    return runtime.pulseIn(Number(args[0]), String(args[1]), Number(args[2] ?? 1_000_000));
  }

  if (name === 'millis') {
    return runtime.millis();
  }

  if (name === 'micros') {
    return runtime.micros();
  }

  throw new Error(`Chamada Arduino nao suportada pela firmware engine: ${name}()`);
}

function applyOperator(operator, left, right) {
  if (operator === '&&') {
    return Boolean(left) && Boolean(right);
  }

  if (operator === '||') {
    return Boolean(left) || Boolean(right);
  }

  if (operator === '==') {
    return left === right;
  }

  if (operator === '!=') {
    return left !== right;
  }

  if (operator === '<') {
    return left < right;
  }

  if (operator === '<=') {
    return left <= right;
  }

  if (operator === '>') {
    return left > right;
  }

  if (operator === '>=') {
    return left >= right;
  }

  if (operator === '+') {
    return Number(left) + Number(right);
  }

  if (operator === '-') {
    return Number(left) - Number(right);
  }

  if (operator === '*') {
    return Number(left) * Number(right);
  }

  if (operator === '/') {
    return Number(left) / Number(right);
  }

  return 0;
}

function parseCall(statement) {
  const match = /^([A-Za-z_][A-Za-z0-9_.]*)\s*\((.*)\)$/.exec(statement);

  if (!match) {
    return null;
  }

  return {
    name: match[1],
    args: splitArguments(match[2])
  };
}

function splitArguments(source) {
  const args = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const last = source.slice(start).trim();
  if (last) {
    args.push(last);
  }

  return args;
}

function findMatchingParen(code, openParenIndex) {
  let depth = 0;

  for (let index = openParenIndex; index < code.length; index += 1) {
    if (code[index] === '(') {
      depth += 1;
    } else if (code[index] === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }

  return index;
}

function isBoundary(char) {
  return !char || /\W/.test(char);
}

function checkpoint(context, label, runtime, program = null) {
  context.checkpoints.push({
    label,
    timeUs: runtime.clock.nowUs(),
    pins: program?.pins ? { ...program.pins } : undefined
  });
}

function pinConstantName(name) {
  return {
    trigger: 'TRIGGER_PIN',
    echo: 'ECHO_PIN',
    led: 'LED_PIN'
  }[name] ?? name;
}

function referencesPinConstant(code, constantName) {
  return new RegExp(`\\b${constantName}\\b`).test(code);
}

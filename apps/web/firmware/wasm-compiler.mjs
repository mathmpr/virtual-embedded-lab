import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  resolveWasmShimLibraries,
  stripRegisteredFirmwareIncludes,
  supportedWasmLibraryDocs,
  wasmShimImportsForLibraries
} from './wasm-shim-registry.mjs';

const defaultTimeoutMs = 8000;
const wasmBuildCache = new Map();

export async function compileFirmwareWasmWithClang(code, options = {}) {
  const clangCommand = options.command ?? process.env.CLANGXX ?? process.env.CLANG_PATH ?? 'clang++';
  const workDir = await mkdtemp(join(tmpdir(), 'virtual-lab-wasm-'));
  const sourcePath = join(workDir, 'main.ino.cpp');
  const wasmPath = join(workDir, 'firmware.wasm');
  const constantExports = firmwareConstantExports(code);
  const libraries = resolveWasmShimLibraries(code);
  const source = wasmShim(code, { constants: options.constants ?? {}, constantExports, libraries });
  const sandbox = resolveWasmSandbox(options.sandbox);
  const cacheKey = wasmBuildCacheKey({
    source,
    constantExports,
    clangCommand,
    sandbox
  });

  if (options.cache !== false && wasmBuildCache.has(cacheKey)) {
    return {
      ...cloneCacheResult(wasmBuildCache.get(cacheKey)),
      cacheHit: true,
      cacheKey
    };
  }

  let invocationCommand = clangCommand;

  try {
    await writeFile(sourcePath, source, 'utf8');
    const invocation = createCompilerInvocation({
      clangCommand,
      sourcePath,
      wasmPath,
      workDir,
      constantExports,
      sandbox
    });
    invocationCommand = invocation.command;

    const result = await runCompiler(invocation.command, invocation.args, options.timeoutMs ?? defaultTimeoutMs);
    const diagnostics = parseCompilerDiagnostics(result.stderr);

    if (result.exitCode !== 0) {
      return {
        available: true,
        ok: false,
        diagnostics,
        wasmBase64: null,
        cacheHit: false,
        cacheKey,
        sandbox: sandbox.name
      };
    }

    const wasm = await readFile(wasmPath);
    const compiled = {
      available: true,
      ok: true,
      diagnostics,
      wasmBase64: wasm.toString('base64'),
      bytes: wasm.byteLength,
      exports: ['__vl_setup', '__vl_loop', 'memory', ...constantExports.map((name) => `__vl_const_${name}`)],
      constantExports,
      imports: wasmShimImportsForLibraries(libraries),
      libraries: libraries.map((library) => library.id),
      supportedLibraries: supportedWasmLibraryDocs(),
      cacheHit: false,
      cacheKey,
      sandbox: sandbox.name
    };

    if (options.cache !== false) {
      wasmBuildCache.set(cacheKey, cloneCacheResult(compiled));
    }

    return compiled;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return unavailableDiagnostic(invocationCommand, sandbox, cacheKey, missingToolchainMessage(sandbox));
    }

    if (isMissingWasmLinker(error)) {
      return unavailableDiagnostic(clangCommand, sandbox, cacheKey, 'Linker WASM nao encontrado. Instale lld/wasm-ld para gerar firmware .wasm.');
    }

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function missingToolchainMessage(sandbox) {
  if (sandbox.name === 'none') {
    return 'Clang nao encontrado. Instale clang++ ou defina CLANGXX.';
  }

  return 'Runtime de sandbox nao encontrado. Instale docker/podman ou defina WASM_COMPILER_CONTAINER_RUNTIME.';
}

export function clearFirmwareWasmBuildCache() {
  wasmBuildCache.clear();
}

function createCompilerInvocation({ clangCommand, sourcePath, wasmPath, workDir, constantExports, sandbox }) {
  const compilerArgs = [
    '--target=wasm32',
    '-x',
    'c++',
    '-std=c++17',
    '-Os',
    '-nostdlib',
    '-fno-exceptions',
    '-fno-rtti',
    '-Wl,--no-entry',
    '-Wl,--export=__vl_setup',
    '-Wl,--export=__vl_loop',
    '-Wl,--export=memory',
    ...constantExports.map((name) => `-Wl,--export=__vl_const_${name}`),
    '-Wl,--allow-undefined'
  ];

  if (sandbox.name === 'none') {
    return {
      command: clangCommand,
      args: [
        ...compilerArgs,
        sourcePath,
        '-o',
        wasmPath
      ]
    };
  }

  return {
    command: sandbox.runtime,
    args: [
      'run',
      '--rm',
      '--network',
      'none',
      '--cpus',
      String(sandbox.cpus),
      '--memory',
      sandbox.memory,
      '--pids-limit',
      String(sandbox.pidsLimit),
      '-v',
      `${workDir}:/workspace:rw`,
      '-w',
      '/workspace',
      sandbox.image,
      clangCommand,
      ...compilerArgs,
      '/workspace/main.ino.cpp',
      '-o',
      '/workspace/firmware.wasm'
    ]
  };
}

function runCompiler(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = '';
    let stdout = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Compilacao WASM excedeu timeout de ${timeoutMs} ms.`));
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

function resolveWasmSandbox(sandbox = {}) {
  const mode = sandbox.mode ?? process.env.WASM_COMPILER_SANDBOX ?? 'none';

  if (mode === 'none' || mode === false) {
    return { name: 'none' };
  }

  if (mode !== 'docker' && mode !== 'podman') {
    return { name: 'none' };
  }

  return {
    name: mode,
    runtime: sandbox.runtime ?? process.env.WASM_COMPILER_CONTAINER_RUNTIME ?? mode,
    image: sandbox.image ?? process.env.WASM_COMPILER_IMAGE ?? 'virtual-embedded-lab-wasm-toolchain:latest',
    cpus: sandbox.cpus ?? process.env.WASM_COMPILER_CPUS ?? '1',
    memory: sandbox.memory ?? process.env.WASM_COMPILER_MEMORY ?? '256m',
    pidsLimit: sandbox.pidsLimit ?? process.env.WASM_COMPILER_PIDS_LIMIT ?? '64'
  };
}

function wasmBuildCacheKey({ source, constantExports, clangCommand, sandbox }) {
  return createHash('sha256')
    .update(JSON.stringify({
      version: 2,
      source,
      constantExports,
      clangCommand,
      sandbox
    }))
    .digest('hex');
}

function cloneCacheResult(result) {
  return JSON.parse(JSON.stringify(result));
}

function parseCompilerDiagnostics(stderr) {
  return stderr
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      source: 'clang-wasm',
      severity: line.includes('error:') || line.includes('wasm-ld: error') ? 'error' : 'note',
      code: 'WASM_COMPILER',
      message: line
    }));
}

function unavailableDiagnostic(command, sandbox, cacheKey, message) {
  return {
    available: false,
    ok: false,
    diagnostics: [
      {
        source: 'clang-wasm',
        severity: 'warning',
        code: 'WASM_TOOLCHAIN_UNAVAILABLE',
        message: `${message} Comando: ${basename(command)}`
      }
    ],
    wasmBase64: null,
    cacheHit: false,
    cacheKey,
    sandbox: sandbox.name
  };
}

function isMissingWasmLinker(error) {
  return /wasm-ld|linker command failed|unable to execute command|No such file/i.test(String(error.message));
}

function wasmShim(code, options = {}) {
  const source = normalizeFirmwareSource(code);

  return `${shimSource(options.constants ?? {})}\n${inferredAliasSource(source)}${stripRegisteredFirmwareIncludes(source, options.libraries ?? [])}\n${constantExportWrappers(options.constantExports ?? [])}${entrypointWrappers()}\n`;
}

function shimSource(constants = {}) {
  const ledBuiltin = Number.isInteger(constants.LED_BUILTIN) ? constants.LED_BUILTIN : 13;

  return `using uint8_t = unsigned char;
using uint16_t = unsigned short;
using uint32_t = unsigned int;

extern "C" void __vl_pinMode(int pin, int mode);
extern "C" void __vl_digitalWrite(int pin, int value);
extern "C" int __vl_digitalRead(int pin);
extern "C" int __vl_analogRead(int pin);
extern "C" void __vl_delay(unsigned long milliseconds);
extern "C" void __vl_delayMicroseconds(unsigned long microseconds);
extern "C" unsigned long __vl_pulseIn(int pin, int value, unsigned long timeout);
extern "C" unsigned long __vl_millis();
extern "C" unsigned long __vl_micros();
extern "C" void __vl_serialBegin(unsigned long baudRate);
extern "C" void __vl_serialPrint(const char *value);
extern "C" void __vl_serialPrintln(const char *value);
extern "C" void __vl_serialPrintInt(int value);
extern "C" void __vl_serialPrintlnInt(int value);
extern "C" void __vl_serialPrintFloat(double value);
extern "C" void __vl_serialPrintlnFloat(double value);
extern "C" void __vl_serialWrite(int value);
extern "C" int __vl_serialAvailable();
extern "C" int __vl_serialRead();
extern "C" void __vl_wireBegin();
extern "C" void __vl_wireBeginTransmission(int address);
extern "C" int __vl_wireWrite(int value);
extern "C" int __vl_wireEndTransmission();
extern "C" int __vl_wireRequestFrom(int address, int count);
extern "C" int __vl_wireAvailable();
extern "C" int __vl_wireRead();
extern "C" bool __vl_bmp280Begin(int address);
extern "C" double __vl_bmp280ReadTemperature(int address);
extern "C" double __vl_bmp280ReadPressure(int address);
extern "C" bool __vl_adcBegin(int address, int type);
extern "C" int __vl_adcReadSingleEnded(int address, int channel);
extern "C" double __vl_adcComputeVolts(int address, int raw);
extern "C" void __vl_spiBegin();
extern "C" int __vl_spiTransfer(int value);
extern "C" bool __vl_mcp3008Begin(int chipSelectPin);
extern "C" int __vl_mcp3008Read(int chipSelectPin, int channel);
extern "C" void __vl_wifiMode(int mode);
extern "C" int __vl_wifiBegin(const char *ssid, const char *password);
extern "C" int __vl_wifiStatus();
extern "C" bool __vl_wifiSoftAP(const char *ssid, const char *password);
extern "C" int __vl_wifiScanNetworks();
extern "C" int __vl_wifiRssi();
extern "C" int __vl_wifiRssiForSsid(const char *ssid);
extern "C" bool __vl_wifiInternetAvailable();

const int LOW = 0;
const int HIGH = 1;
const int INPUT = 0;
const int OUTPUT = 1;
const int LED_BUILTIN = ${ledBuiltin};
const int A0 = 14;
const int A1 = 15;
const int A2 = 16;
const int A3 = 17;
const int A4 = 18;
const int A5 = 19;
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

void pinMode(int pin, int mode) { __vl_pinMode(pin, mode); }
void digitalWrite(int pin, int value) { __vl_digitalWrite(pin, value); }
int digitalRead(int pin) { return __vl_digitalRead(pin); }
int analogRead(int pin) { return __vl_analogRead(pin); }
void delay(unsigned long milliseconds) { __vl_delay(milliseconds); }
void delayMicroseconds(unsigned long microseconds) { __vl_delayMicroseconds(microseconds); }
unsigned long pulseIn(int pin, int value, unsigned long timeout = 1000000) { return __vl_pulseIn(pin, value, timeout); }
unsigned long millis() { return __vl_millis(); }
unsigned long micros() { return __vl_micros(); }

class HardwareSerial {
public:
  void begin(unsigned long baudRate) { __vl_serialBegin(baudRate); }
  void print(const char *value) { __vl_serialPrint(value); }
  void print(char value) { __vl_serialWrite((int)value); }
  void print(int value) { __vl_serialPrintInt(value); }
  void print(long value) { __vl_serialPrintInt((int)value); }
  void print(unsigned long value) { __vl_serialPrintInt((int)value); }
  void print(float value) { __vl_serialPrintFloat((double)value); }
  void print(double value) { __vl_serialPrintFloat(value); }
  void println() { __vl_serialPrintln(""); }
  void println(const char *value) { __vl_serialPrintln(value); }
  void println(char value) { __vl_serialWrite((int)value); __vl_serialPrintln(""); }
  void println(int value) { __vl_serialPrintlnInt(value); }
  void println(long value) { __vl_serialPrintlnInt((int)value); }
  void println(unsigned long value) { __vl_serialPrintlnInt((int)value); }
  void println(float value) { __vl_serialPrintlnFloat((double)value); }
  void println(double value) { __vl_serialPrintlnFloat(value); }
  void write(int value) { __vl_serialWrite(value); }
  int available() { return __vl_serialAvailable(); }
  int read() { return __vl_serialRead(); }
};

HardwareSerial Serial;

class TwoWire {
public:
  void begin() { __vl_wireBegin(); }
  void beginTransmission(int address) { __vl_wireBeginTransmission(address); }
  int write(int value) { return __vl_wireWrite(value); }
  int endTransmission() { return __vl_wireEndTransmission(); }
  int requestFrom(int address, int count) { return __vl_wireRequestFrom(address, count); }
  int available() { return __vl_wireAvailable(); }
  int read() { return __vl_wireRead(); }
};

TwoWire Wire;

class BMP280 {
public:
  BMP280() : address(0x76), initialized(false) {}
  bool begin(int requestedAddress = 0x76) {
    address = requestedAddress;
    initialized = __vl_bmp280Begin(address);
    return initialized;
  }
  double readTemperature() { return initialized ? __vl_bmp280ReadTemperature(address) : 0; }
  double readPressure() { return initialized ? __vl_bmp280ReadPressure(address) : 0; }
private:
  int address;
  bool initialized;
};

const int __VL_ADC_ADS1015 = 1015;
const int __VL_ADC_ADS1115 = 1115;

class ADS1015 {
public:
  ADS1015() : address(0x48), initialized(false) {}
  bool begin(int requestedAddress = 0x48) {
    address = requestedAddress;
    initialized = __vl_adcBegin(address, __VL_ADC_ADS1015);
    return initialized;
  }
  int readADC_SingleEnded(int channel) { return initialized ? __vl_adcReadSingleEnded(address, channel) : 0; }
  double computeVolts(int raw) { return initialized ? __vl_adcComputeVolts(address, raw) : 0; }
private:
  int address;
  bool initialized;
};

class ADS1115 {
public:
  ADS1115() : address(0x48), initialized(false) {}
  bool begin(int requestedAddress = 0x48) {
    address = requestedAddress;
    initialized = __vl_adcBegin(address, __VL_ADC_ADS1115);
    return initialized;
  }
  int readADC_SingleEnded(int channel) { return initialized ? __vl_adcReadSingleEnded(address, channel) : 0; }
  double computeVolts(int raw) { return initialized ? __vl_adcComputeVolts(address, raw) : 0; }
private:
  int address;
  bool initialized;
};

class SPIClass {
public:
  void begin() { __vl_spiBegin(); }
  int transfer(int value) { return __vl_spiTransfer(value); }
};

SPIClass SPI;

class MCP3008 {
public:
  MCP3008() : chipSelectPin(10), initialized(false) {}
  bool begin(int requestedChipSelectPin = 10) {
    chipSelectPin = requestedChipSelectPin;
    initialized = __vl_mcp3008Begin(chipSelectPin);
    return initialized;
  }
  int read(int channel) { return initialized ? __vl_mcp3008Read(chipSelectPin, channel) : 0; }
private:
  int chipSelectPin;
  bool initialized;
};

class WiFiClass {
public:
  void mode(int mode) { __vl_wifiMode(mode); }
  int begin(const char *ssid) { return __vl_wifiBegin(ssid, ""); }
  int begin(const char *ssid, const char *password) { return __vl_wifiBegin(ssid, password); }
  int status() { return __vl_wifiStatus(); }
  bool softAP(const char *ssid) { return __vl_wifiSoftAP(ssid, ""); }
  bool softAP(const char *ssid, const char *password) { return __vl_wifiSoftAP(ssid, password); }
  int scanNetworks() { return __vl_wifiScanNetworks(); }
  int RSSI() { return __vl_wifiRssi(); }
  int RSSI(const char *ssid) { return __vl_wifiRssiForSsid(ssid); }
  bool internetAvailable() { return __vl_wifiInternetAvailable(); }
};

WiFiClass WiFi;
`;
}

function inferredAliasSource(code) {
  return ['LED_PIN', 'PIN']
    .filter((alias) => referencesIdentifier(code, alias) && !declaresIdentifier(code, alias))
    .map((alias) => `const int ${alias} = LED_BUILTIN;`)
    .join('\n')
    .concat('\n');
}

function constantExportWrappers(names) {
  return names
    .map((name) => `extern "C" int __vl_const_${name}() { return ${name}; }`)
    .join('\n')
    .concat(names.length > 0 ? '\n' : '');
}

function entrypointWrappers() {
  return `extern "C" void __vl_setup() { setup(); }
extern "C" void __vl_loop() { loop(); }
`;
}

function firmwareConstantExports(code) {
  const source = normalizeFirmwareSource(code);
  const names = new Set(['LED_BUILTIN']);
  const declarationPattern = /(?:const\s+(?:int|long|unsigned\s+long)|#define)\s+([A-Z][A-Z0-9_]*)\b/g;

  for (const match of source.matchAll(declarationPattern)) {
    names.add(match[1]);
  }

  for (const alias of ['LED_PIN', 'PIN']) {
    if (referencesIdentifier(source, alias) && !declaresIdentifier(source, alias)) {
      names.add(alias);
    }
  }

  return [...names];
}

function normalizeFirmwareSource(code) {
  return code.includes('\n') ? code : code.replaceAll('\\n', '\n');
}

function referencesIdentifier(code, identifier) {
  return new RegExp(`\\b${identifier}\\b`).test(code);
}

function declaresIdentifier(code, identifier) {
  return new RegExp(`(?:const\\s+int|#define)\\s+${identifier}\\b`).test(code);
}

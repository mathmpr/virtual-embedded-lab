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
      version: 3,
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
using size_t = unsigned long;
using byte = unsigned char;
#define IRAM_ATTR

extern "C" void __vl_pinMode(int pin, int mode);
extern "C" void __vl_digitalWrite(int pin, int value);
extern "C" int __vl_digitalRead(int pin);
extern "C" int __vl_analogRead(int pin);
extern "C" void __vl_delay(unsigned long milliseconds);
extern "C" void __vl_delayMicroseconds(unsigned long microseconds);
extern "C" unsigned long __vl_pulseIn(int pin, int value, unsigned long timeout);
extern "C" unsigned long __vl_millis();
extern "C" unsigned long __vl_micros();
extern "C" void __vl_tone(int pin, int frequency);
extern "C" void __vl_noTone(int pin);
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
extern "C" bool __vl_lcdBegin(int address, int columns, int rows);
extern "C" void __vl_lcdSetCursor(int address, int column, int row);
extern "C" void __vl_lcdPrint(int address, const char *value);
extern "C" void __vl_lcdPrintInt(int address, int value);
extern "C" void __vl_lcdClear(int address);
extern "C" void __vl_lcdBacklight(int address, bool enabled);
extern "C" bool __vl_dhtBegin(int pin, int type);
extern "C" double __vl_dhtReadTemperature(int pin, int type);
extern "C" double __vl_dhtReadHumidity(int pin, int type);
extern "C" bool __vl_servoAttach(int pin);
extern "C" void __vl_servoWrite(int pin, int angle);
extern "C" void __vl_servoWriteMicroseconds(int pin, int pulseUs);
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
extern "C" int __vl_tcpConnect(const char *host, int port);
extern "C" int __vl_tcpPrint(const char *data);
extern "C" int __vl_tcpPrintln(const char *data);
extern "C" int __vl_tcpAvailable();
extern "C" int __vl_tcpRead();
extern "C" void __vl_tcpStop();
extern "C" int __vl_tcpConnected();
extern "C" void __vl_mqttSetServer(const char *host, int port);
extern "C" int __vl_mqttConnect();
extern "C" void __vl_mqttDisconnect();
extern "C" int __vl_mqttConnected();
extern "C" unsigned short __vl_mqttSubscribe(const char *topic, int qos);
extern "C" unsigned short __vl_mqttPublish(const char *topic, int qos, bool retain, const char *payload);
extern "C" int __vl_mqttReadMessage(const char *subscribedTopic, char *topic, int topicMax, char *payload, int payloadMax);

const int LOW = 0;
const int HIGH = 1;
const int INPUT = 0;
const int OUTPUT = 1;
const int INPUT_PULLUP = 2;
const int FALLING = 2;
const int LSBFIRST = 0;
const int MSBFIRST = 1;
const int LED_BUILTIN = ${ledBuiltin};
const int A0 = 14;
const int A1 = 15;
const int A2 = 16;
const int A3 = 17;
const int A4 = 18;
const int A5 = 19;
const int A6 = 20;
const int A7 = 21;
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
const int DHT11 = 11;
const int DHT22 = 22;

void pinMode(int pin, int mode) { __vl_pinMode(pin, mode); }
void digitalWrite(int pin, int value) { __vl_digitalWrite(pin, value); }
int digitalRead(int pin) { return __vl_digitalRead(pin); }
int analogRead(int pin) { return __vl_analogRead(pin); }
void delay(unsigned long milliseconds) { __vl_delay(milliseconds); }
void delayMicroseconds(unsigned long microseconds) { __vl_delayMicroseconds(microseconds); }
unsigned long pulseIn(int pin, int value, unsigned long timeout = 1000000) { return __vl_pulseIn(pin, value, timeout); }
unsigned long millis() { return __vl_millis(); }
unsigned long micros() { return __vl_micros(); }
unsigned long __vl_random_state = 1;
void shiftOut(int dataPin, int clockPin, int bitOrder, int value) {
  for (int index = 0; index < 8; index++) {
    int bit = bitOrder == LSBFIRST ? index : 7 - index;
    digitalWrite(dataPin, (value & (1 << bit)) ? HIGH : LOW);
    digitalWrite(clockPin, HIGH);
    digitalWrite(clockPin, LOW);
  }
}
void tone(int pin, int frequency) { __vl_tone(pin, frequency); }
void noTone(int pin) { __vl_noTone(pin); }
void randomSeed(unsigned long seed) { __vl_random_state = seed ? seed : 1; }
long random(long max) {
  __vl_random_state += 0x9e3779b9UL;
  unsigned long mixed = __vl_random_state;
  mixed = (mixed ^ (mixed >> 16)) * 0x85ebca6bUL;
  mixed = (mixed ^ (mixed >> 13)) * 0xc2b2ae35UL;
  mixed = mixed ^ (mixed >> 16);
  return max <= 0 ? 0 : (long)(mixed % (unsigned long)max);
}
long random(long min, long max) {
  if (max <= min) {
    return min;
  }
  return min + random(max - min);
}
void yield() {}
int digitalPinToInterrupt(int pin) { return pin; }
void attachInterrupt(int, void (*)(), int) {}
bool isnan(double value) { return value != value; }

int __vl_append_char(char *buffer, size_t size, int index, char value) {
  if (index < (int)size - 1) {
    buffer[index] = value;
  }
  return index + 1;
}

int __vl_append_string(char *buffer, size_t size, int index, const char *value) {
  int source = 0;
  while (value && value[source] != 0) {
    index = __vl_append_char(buffer, size, index, value[source]);
    source++;
  }
  return index;
}

int __vl_append_int(char *buffer, size_t size, int index, int value) {
  char digits[16];
  int count = 0;
  if (value < 0) {
    index = __vl_append_char(buffer, size, index, '-');
    value = -value;
  }
  do {
    digits[count++] = (char)('0' + (value % 10));
    value /= 10;
  } while (value > 0 && count < 16);
  while (count > 0) {
    index = __vl_append_char(buffer, size, index, digits[--count]);
  }
  return index;
}

void __vl_terminate(char *buffer, size_t size, int index) {
  if (size == 0) {
    return;
  }
  buffer[index < (int)size ? index : (int)size - 1] = 0;
}

int snprintf(char *buffer, size_t size, const char *, const char *first, const char *second) {
  int index = __vl_append_string(buffer, size, 0, first);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, second);
  __vl_terminate(buffer, size, index);
  return index;
}

int snprintf(char *buffer, size_t size, const char *, const char *first, const char *second, int third) {
  int index = __vl_append_string(buffer, size, 0, first);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, second);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_int(buffer, size, index, third);
  __vl_terminate(buffer, size, index);
  return index;
}

int snprintf(char *buffer, size_t size, const char *, const char *first, const char *second, const char *third, const char *fourth) {
  int index = __vl_append_string(buffer, size, 0, first);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, second);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, third);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, fourth);
  __vl_terminate(buffer, size, index);
  return index;
}

class String {
public:
  String() { clear(); }
  String(const char *value) { assign(value); }
  void operator+=(char value) {
    int currentLength = length();
    if (currentLength < 127) {
      buffer[currentLength] = value;
      buffer[currentLength + 1] = 0;
    }
  }
  bool operator==(const char *value) const { return equals(value); }
  const char *c_str() const { return buffer; }
  int toInt() const {
    int value = 0;
    int sign = buffer[0] == '-' ? -1 : 1;
    int index = sign < 0 ? 1 : 0;
    while (buffer[index] >= '0' && buffer[index] <= '9') {
      value = value * 10 + (buffer[index] - '0');
      index++;
    }
    return value * sign;
  }
private:
  char buffer[128];
  void clear() { buffer[0] = 0; }
  int length() const {
    int index = 0;
    while (buffer[index] != 0 && index < 127) { index++; }
    return index;
  }
  void assign(const char *value) {
    int index = 0;
    while (value && value[index] != 0 && index < 127) {
      buffer[index] = value[index];
      index++;
    }
    buffer[index] = 0;
  }
  bool equals(const char *value) const {
    int index = 0;
    while (buffer[index] != 0 || (value && value[index] != 0)) {
      if (!value || buffer[index] != value[index]) {
        return false;
      }
      index++;
    }
    return true;
  }
};

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

class LiquidCrystal_I2C {
public:
  LiquidCrystal_I2C(int requestedAddress, int requestedColumns, int requestedRows)
    : address(requestedAddress), columns(requestedColumns), rows(requestedRows), initialized(false) {}
  void init() { initialized = __vl_lcdBegin(address, columns, rows); }
  void begin() { init(); }
  void begin(int requestedColumns, int requestedRows) {
    columns = requestedColumns;
    rows = requestedRows;
    init();
  }
  void backlight() { __vl_lcdBacklight(address, true); }
  void noBacklight() { __vl_lcdBacklight(address, false); }
  void setCursor(int column, int row) { __vl_lcdSetCursor(address, column, row); }
  void clear() { __vl_lcdClear(address); }
  void print(const char *value) { __vl_lcdPrint(address, value); }
  void print(char value) {
    char text[2] = { value, 0 };
    __vl_lcdPrint(address, text);
  }
  void print(int value) { __vl_lcdPrintInt(address, value); }
  void print(long value) { __vl_lcdPrintInt(address, (int)value); }
  void print(unsigned long value) { __vl_lcdPrintInt(address, (int)value); }
  void print(String value) { __vl_lcdPrint(address, value.c_str()); }
private:
  int address;
  int columns;
  int rows;
  bool initialized;
};

class DHT {
public:
  DHT(int requestedPin, int requestedType) : pin(requestedPin), type(requestedType), initialized(false) {}
  void begin() { initialized = __vl_dhtBegin(pin, type); }
  float readTemperature() { return initialized ? (float)__vl_dhtReadTemperature(pin, type) : 0.0f; }
  float readHumidity() { return initialized ? (float)__vl_dhtReadHumidity(pin, type) : 0.0f; }
private:
  int pin;
  int type;
  bool initialized;
};

class Servo {
public:
  Servo() : pin(-1), attached(false) {}
  int attach(int requestedPin) {
    pin = requestedPin;
    attached = __vl_servoAttach(pin);
    return attached ? 1 : 0;
  }
  void write(int angle) {
    if (attached) {
      __vl_servoWrite(pin, angle);
    }
  }
  void writeMicroseconds(int pulseUs) {
    if (attached) {
      __vl_servoWriteMicroseconds(pin, pulseUs);
    }
  }
private:
  int pin;
  bool attached;
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
  void disconnect() {}
  void setAutoReconnect(bool) {}
  void persistent(bool) {}
  void scanDelete() {}
  String SSID(int) { return String("VirtualLab"); }
};

WiFiClass WiFi;

class WiFiClient {
public:
  int connect(const char *host, int port) { return __vl_tcpConnect(host, port); }
  int print(const char *value) { return __vl_tcpPrint(value); }
  int println() { return __vl_tcpPrintln(""); }
  int println(const char *value) { return __vl_tcpPrintln(value); }
  int available() { return __vl_tcpAvailable(); }
  int read() { return __vl_tcpRead(); }
  void stop() { __vl_tcpStop(); }
  int connected() { return __vl_tcpConnected(); }
};

class WiFiEventHandler {};
class WiFiEventStationModeGotIP {};
class WiFiEventStationModeDisconnected {};

class ESPClass {
public:
  void restart() {}
  void wdtDisable() {}
  void wdtEnable(int) {}
  void wdtFeed() {}
};

ESPClass ESP;
const int WDTO_8S = 8000;

enum AsyncMqttClientDisconnectReason {
  TCP_DISCONNECTED = 0,
  MQTT_UNACCEPTABLE_PROTOCOL_VERSION = 1,
  MQTT_IDENTIFIER_REJECTED = 2,
  MQTT_SERVER_UNAVAILABLE = 3,
  MQTT_MALFORMED_CREDENTIALS = 4,
  MQTT_NOT_AUTHORIZED = 5
};

struct AsyncMqttClientMessageProperties {
  bool dup;
  unsigned char qos;
  bool retain;
};

class AsyncMqttClient {
public:
  AsyncMqttClient() : connectCallback(0), disconnectCallback(0), messageCallback(0), subscriptionCount(0) {}
  void setServer(const char *host, unsigned short port) { __vl_mqttSetServer(host, port); }
  void onConnect(void (*callback)(bool)) { connectCallback = callback; }
  void onDisconnect(void (*callback)(AsyncMqttClientDisconnectReason)) { disconnectCallback = callback; }
  void onMessage(void (*callback)(char *, char *, AsyncMqttClientMessageProperties, size_t, size_t, size_t)) { messageCallback = callback; }
  void connect() {
    if (__vl_mqttConnect() && connectCallback) {
      connectCallback(false);
    }
  }
  void disconnect() {
    __vl_mqttDisconnect();
    if (disconnectCallback) {
      disconnectCallback(TCP_DISCONNECTED);
    }
  }
  bool connected() {
    bool active = __vl_mqttConnected();
    if (active) {
      pollMessages();
    }
    return active;
  }
  unsigned short subscribe(const char *topic, unsigned char qos) {
    unsigned short packetId = __vl_mqttSubscribe(topic, qos);
    if (subscriptionCount < 8) {
      copySubscription(subscriptionCount, topic);
      subscriptionCount++;
    }
    pollMessages();
    return packetId;
  }
  unsigned short publish(const char *topic, unsigned char qos, bool retain, const char *payload) {
    unsigned short packetId = __vl_mqttPublish(topic, qos, retain, payload);
    pollMessages();
    return packetId;
  }
private:
  void (*connectCallback)(bool);
  void (*disconnectCallback)(AsyncMqttClientDisconnectReason);
  void (*messageCallback)(char *, char *, AsyncMqttClientMessageProperties, size_t, size_t, size_t);
  char subscriptions[8][128];
  int subscriptionCount;
  void copySubscription(int slot, const char *topic) {
    int index = 0;
    while (topic && topic[index] != 0 && index < 127) {
      subscriptions[slot][index] = topic[index];
      index++;
    }
    subscriptions[slot][index] = 0;
  }
  void pollMessages() {
    for (int index = 0; index < subscriptionCount; index++) {
      for (int attempt = 0; attempt < 16; attempt++) {
        if (!deliverSubscribedMessage(subscriptions[index])) {
          break;
        }
      }
    }
  }
  bool deliverSubscribedMessage(const char *subscription) {
    if (!messageCallback) {
      return false;
    }
    char topic[128];
    char payload[256];
    int length = __vl_mqttReadMessage(subscription, topic, 128, payload, 256);
    if (length >= 0) {
      AsyncMqttClientMessageProperties properties = { false, 0, false };
      messageCallback(topic, payload, properties, (size_t)length, 0, (size_t)length);
      return true;
    }
    return false;
  }
};

class SimpleTimer {
public:
  SimpleTimer() : count(0) {}
  int setInterval(unsigned long interval, void (*callback)()) {
    if (count >= 8) {
      return -1;
    }
    timers[count] = { interval, millis(), callback };
    count++;
    return count;
  }
  void run() {
    unsigned long now = millis();
    for (int index = 0; index < count; index++) {
      if (timers[index].callback && now - timers[index].last >= timers[index].interval) {
        timers[index].last = now;
        timers[index].callback();
      }
    }
  }
private:
  struct TimerEntry {
    unsigned long interval;
    unsigned long last;
    void (*callback)();
  };
  TimerEntry timers[8];
  int count;
};
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

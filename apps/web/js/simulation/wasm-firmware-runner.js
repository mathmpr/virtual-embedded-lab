import {
  createWasmImportRegistry,
  registerDefaultWasmImportAdapters
} from './wasm-import-adapters.js';

export async function runWasmFirmware(runtime, wasmBase64, options = {}) {
  const session = await createWasmFirmwareSession(runtime, wasmBase64);
  session.setup();
  return session.runLoop(options);
}

export async function createWasmFirmwareSession(runtime, wasmBase64) {
  const bytes = base64ToBytes(wasmBase64);
  let memory = null;
  const { instance } = await WebAssembly.instantiate(bytes, createImports(runtime, () => memory));
  memory = instance.exports.memory;
  const constants = readExportedConstants(instance.exports);

  return {
    constants,
    setup() {
      instance.exports.__vl_setup();
    },
    runLoop(options = {}) {
      const loopIterations = Math.max(1, Number(options.loopIterations ?? 1));

      for (let iteration = 0; iteration < loopIterations; iteration += 1) {
        instance.exports.__vl_loop();
      }

      return wasmFirmwareResult(runtime, {
        pinEvents: options.drainEvents ? runtime.drainPinEvents() : runtime.getPinEventsSnapshot(),
        serial: options.drainEvents ? runtime.drainSerialEvents() : runtime.getSerialSnapshot()
      });
    }
  };
}

function readExportedConstants(exports) {
  const constants = {};

  for (const [name, value] of Object.entries(exports)) {
    if (!name.startsWith('__vl_const_') || typeof value !== 'function') {
      continue;
    }

    constants[name.replace('__vl_const_', '')] = value();
  }

  return constants;
}

function createImports(runtime, getMemory) {
  const registry = createWasmImportRegistry();
  registerDefaultWasmImportAdapters(registry);

  return {
    env: registry.createImports({
      runtime,
      readCString(pointer) {
        return readCString(getMemory(), pointer);
      },
      writeCString(pointer, maxLength, value) {
        return writeCString(getMemory(), pointer, maxLength, value);
      }
    })
  };
}

function wasmFirmwareResult(runtime, snapshots) {
  return {
    echoDuration: 0,
    distanceCm: 0,
    ledValue: 'LOW',
    variables: {},
    checkpoints: [
      {
        label: 'after-wasm',
        timeUs: runtime.clock.nowUs()
      }
    ],
    pinStates: runtime.getPinsSnapshot(),
    analogPinStates: runtime.getAnalogPinsSnapshot(),
    pinEvents: snapshots.pinEvents,
    serial: snapshots.serial,
    i2c: runtime.getI2cSnapshot(),
    spi: runtime.getSpiSnapshot(),
    wifi: runtime.getWifiSnapshot(),
    mqtt: runtime.getMqttSnapshot(),
    source: 'wasm'
  };
}

function base64ToBytes(value) {
  if (globalThis.Buffer) {
    return Buffer.from(value, 'base64');
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function readCString(memory, pointer) {
  if (!memory || !pointer) {
    return '';
  }

  const bytes = new Uint8Array(memory.buffer);
  let end = pointer;

  while (end < bytes.length && bytes[end] !== 0) {
    end += 1;
  }

  return new TextDecoder().decode(bytes.subarray(pointer, end));
}

function writeCString(memory, pointer, maxLength, value) {
  if (!memory || !pointer || maxLength <= 0) {
    return 0;
  }

  const bytes = new Uint8Array(memory.buffer);
  const text = String(value ?? '');
  const length = Math.max(0, Math.min(maxLength - 1, text.length));

  for (let index = 0; index < length; index += 1) {
    bytes[pointer + index] = text.charCodeAt(index) & 0xff;
  }

  bytes[pointer + length] = 0;
  return length;
}

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
  return {
    env: {
      __vl_pinMode(pin, mode) {
        runtime.pinMode(Number(pin), mode === 1 ? 'OUTPUT' : 'INPUT');
      },
      __vl_digitalWrite(pin, value) {
        runtime.digitalWrite(Number(pin), value === 1 ? 'HIGH' : 'LOW');
      },
      __vl_digitalRead(pin) {
        return runtime.digitalRead(Number(pin)) === 'HIGH' ? 1 : 0;
      },
      __vl_analogRead(pin) {
        return runtime.analogRead(Number(pin));
      },
      __vl_delay(milliseconds) {
        runtime.delay(Number(milliseconds));
      },
      __vl_delayMicroseconds(microseconds) {
        runtime.delayMicroseconds(Number(microseconds));
      },
      __vl_pulseIn(pin, value, timeout) {
        return runtime.pulseIn(Number(pin), value === 1 ? 'HIGH' : 'LOW', Number(timeout));
      },
      __vl_millis() {
        return runtime.millis();
      },
      __vl_micros() {
        return runtime.micros();
      },
      __vl_serialBegin(baudRate) {
        runtime.serialBegin(Number(baudRate));
      },
      __vl_serialPrint(pointer) {
        runtime.serialPrint(readCString(getMemory(), pointer));
      },
      __vl_serialPrintln(pointer) {
        runtime.serialPrint(readCString(getMemory(), pointer), true);
      },
      __vl_serialPrintInt(value) {
        runtime.serialPrint(Number(value));
      },
      __vl_serialPrintlnInt(value) {
        runtime.serialPrint(Number(value), true);
      },
      __vl_serialPrintFloat(value) {
        runtime.serialPrint(formatFirmwareFloat(Number(value)));
      },
      __vl_serialPrintlnFloat(value) {
        runtime.serialPrint(formatFirmwareFloat(Number(value)), true);
      },
      __vl_serialWrite(value) {
        runtime.serialWrite(Number(value));
      },
      __vl_serialAvailable() {
        return runtime.serialAvailable();
      },
      __vl_serialRead() {
        return runtime.serialRead();
      },
      __vl_wireBegin() {
        runtime.wireBegin();
      },
      __vl_wireBeginTransmission(address) {
        runtime.wireBeginTransmission(Number(address));
      },
      __vl_wireWrite(value) {
        return runtime.wireWrite(Number(value));
      },
      __vl_wireEndTransmission() {
        return runtime.wireEndTransmission();
      },
      __vl_wireRequestFrom(address, count) {
        return runtime.wireRequestFrom(Number(address), Number(count));
      },
      __vl_wireAvailable() {
        return runtime.wireAvailable();
      },
      __vl_wireRead() {
        return runtime.wireRead();
      },
      __vl_bmp280Begin(address) {
        return runtime.bmp280Begin(Number(address)) ? 1 : 0;
      },
      __vl_bmp280ReadTemperature(address) {
        return runtime.bmp280ReadTemperature(Number(address));
      },
      __vl_bmp280ReadPressure(address) {
        return runtime.bmp280ReadPressure(Number(address));
      },
      __vl_adcBegin(address, type) {
        const expectedType = Number(type) === 1015 ? 'ads1015' : 'ads1115';
        return runtime.adcBegin(Number(address), expectedType) ? 1 : 0;
      },
      __vl_adcReadSingleEnded(address, channel) {
        return runtime.adcReadSingleEnded(Number(address), Number(channel));
      },
      __vl_adcComputeVolts(address, raw) {
        return runtime.adcComputeVolts(Number(address), Number(raw));
      },
      __vl_spiBegin() {
        runtime.spiBegin();
      },
      __vl_spiTransfer(value) {
        return runtime.spiTransfer(Number(value));
      },
      __vl_mcp3008Begin(chipSelectPin) {
        return runtime.mcp3008Begin(Number(chipSelectPin)) ? 1 : 0;
      },
      __vl_mcp3008Read(chipSelectPin, channel) {
        return runtime.mcp3008Read(Number(chipSelectPin), Number(channel));
      },
      __vl_wifiMode(mode) {
        runtime.wifiMode(Number(mode));
      },
      __vl_wifiBegin(ssidPointer, passwordPointer) {
        return runtime.wifiBegin(readCString(getMemory(), ssidPointer), readCString(getMemory(), passwordPointer));
      },
      __vl_wifiStatus() {
        return runtime.wifiStatus();
      },
      __vl_wifiSoftAP(ssidPointer, passwordPointer) {
        return runtime.wifiSoftAp(readCString(getMemory(), ssidPointer), readCString(getMemory(), passwordPointer)) ? 1 : 0;
      },
      __vl_wifiScanNetworks() {
        return runtime.wifiScanNetworks();
      },
      __vl_wifiRssi() {
        return runtime.wifiRssi();
      },
      __vl_wifiRssiForSsid(ssidPointer) {
        return runtime.wifiRssiForSsid(readCString(getMemory(), ssidPointer));
      },
      __vl_wifiInternetAvailable() {
        return runtime.wifiInternetAvailable() ? 1 : 0;
      }
    }
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
    source: 'wasm'
  };
}

function formatFirmwareFloat(value) {
  if (!Number.isFinite(value)) {
    return '0.00';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
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

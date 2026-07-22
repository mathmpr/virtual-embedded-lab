export function createWasmImportRegistry() {
  const adapters = [];

  return {
    register(adapter) {
      if (adapter?.id && typeof adapter.imports === 'function') {
        adapters.push(adapter);
      }
    },
    createImports(context) {
      return Object.assign({}, ...adapters.map((adapter) => adapter.imports(context)));
    }
  };
}

export function registerDefaultWasmImportAdapters(registry) {
  registry.register(arduinoCoreImportAdapter);
  registry.register(serialImportAdapter);
  registry.register(wireImportAdapter);
  registry.register(spiImportAdapter);
}

const arduinoCoreImportAdapter = {
  id: 'arduino-core',
  libraries: ['Arduino'],
  capabilities: ['gpio', 'analog-input', 'time', 'pulse'],
  imports({ runtime }) {
    return {
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
      __vl_tone(pin, frequency) {
        runtime.tone(Number(pin), Number(frequency));
      },
      __vl_noTone(pin) {
        runtime.noTone(Number(pin));
      }
    };
  }
};

const serialImportAdapter = {
  id: 'serial',
  libraries: ['Serial'],
  capabilities: ['serial'],
  imports({ runtime, readCString }) {
    return {
      __vl_serialBegin(baudRate) {
        runtime.serialBegin(Number(baudRate));
      },
      __vl_serialPrint(pointer) {
        runtime.serialPrint(readCString(pointer));
      },
      __vl_serialPrintln(pointer) {
        runtime.serialPrint(readCString(pointer), true);
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
      }
    };
  }
};

const wireImportAdapter = {
  id: 'wire',
  libraries: ['Wire'],
  capabilities: ['i2c'],
  imports({ runtime }) {
    return {
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
      }
    };
  }
};

const spiImportAdapter = {
  id: 'spi',
  libraries: ['SPI'],
  capabilities: ['spi'],
  imports({ runtime }) {
    return {
      __vl_spiBegin() {
        runtime.spiBegin();
      },
      __vl_spiTransfer(value) {
        return runtime.spiTransfer(Number(value));
      }
    };
  }
};

function formatFirmwareFloat(value) {
  if (!Number.isFinite(value)) {
    return '0.00';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

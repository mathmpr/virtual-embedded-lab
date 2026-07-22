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
  registry.register(sensorLibraryImportAdapter);
  registry.register(wifiImportAdapter);
  registry.register(tcpClientImportAdapter);
  registry.register(mqttImportAdapter);
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

const sensorLibraryImportAdapter = {
  id: 'sensor-libraries',
  libraries: ['BMP280', 'ADS1015', 'ADS1115', 'MCP3008'],
  capabilities: ['i2c-sensor', 'i2c-adc', 'spi-adc'],
  imports({ runtime }) {
    return {
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
      __vl_mcp3008Begin(chipSelectPin) {
        return runtime.mcp3008Begin(Number(chipSelectPin)) ? 1 : 0;
      },
      __vl_mcp3008Read(chipSelectPin, channel) {
        return runtime.mcp3008Read(Number(chipSelectPin), Number(channel));
      }
    };
  }
};

const wifiImportAdapter = {
  id: 'wifi',
  libraries: ['WiFi'],
  capabilities: ['wifi'],
  imports({ runtime, readCString }) {
    return {
      __vl_wifiMode(mode) {
        runtime.wifiMode(Number(mode));
      },
      __vl_wifiBegin(ssidPointer, passwordPointer) {
        return runtime.wifiBegin(readCString(ssidPointer), readCString(passwordPointer));
      },
      __vl_wifiStatus() {
        return runtime.wifiStatus();
      },
      __vl_wifiSoftAP(ssidPointer, passwordPointer) {
        return runtime.wifiSoftAp(readCString(ssidPointer), readCString(passwordPointer)) ? 1 : 0;
      },
      __vl_wifiScanNetworks() {
        return runtime.wifiScanNetworks();
      },
      __vl_wifiRssi() {
        return runtime.wifiRssi();
      },
      __vl_wifiRssiForSsid(ssidPointer) {
        return runtime.wifiRssiForSsid(readCString(ssidPointer));
      },
      __vl_wifiInternetAvailable() {
        return runtime.wifiInternetAvailable() ? 1 : 0;
      }
    };
  }
};

const tcpClientImportAdapter = {
  id: 'tcp-client',
  libraries: ['WiFiClient'],
  capabilities: ['tcp-client'],
  imports({ runtime, readCString }) {
    return {
      __vl_tcpConnect(hostPointer, port) {
        return runtime.tcpConnect(readCString(hostPointer), Number(port));
      },
      __vl_tcpPrint(dataPointer) {
        return runtime.tcpPrint(readCString(dataPointer));
      },
      __vl_tcpPrintln(dataPointer) {
        return runtime.tcpPrintln(readCString(dataPointer));
      },
      __vl_tcpAvailable() {
        return runtime.tcpAvailable();
      },
      __vl_tcpRead() {
        return runtime.tcpRead();
      },
      __vl_tcpStop() {
        runtime.tcpStop();
      },
      __vl_tcpConnected() {
        return runtime.tcpConnected();
      }
    };
  }
};

const mqttImportAdapter = {
  id: 'mqtt',
  libraries: ['AsyncMqttClient'],
  capabilities: ['mqtt-client'],
  imports({ runtime, readCString, writeCString }) {
    return {
      __vl_mqttSetServer(hostPointer, port) {
        runtime.mqttSetServer(readCString(hostPointer), Number(port));
      },
      __vl_mqttConnect() {
        return runtime.mqttConnect();
      },
      __vl_mqttDisconnect() {
        runtime.mqttDisconnect();
      },
      __vl_mqttConnected() {
        return runtime.mqttConnected();
      },
      __vl_mqttSubscribe(topicPointer, qos) {
        return runtime.mqttSubscribe(readCString(topicPointer), Number(qos));
      },
      __vl_mqttPublish(topicPointer, qos, retain, payloadPointer) {
        return runtime.mqttPublish(readCString(topicPointer), Number(qos), Boolean(retain), readCString(payloadPointer));
      },
      __vl_mqttReadMessage(subscribedTopicPointer, topicPointer, topicMax, payloadPointer, payloadMax) {
        const message = runtime.mqttReadSubscribedMessage(readCString(subscribedTopicPointer));

        if (!message) {
          return -1;
        }

        writeCString(topicPointer, Number(topicMax), message.topic);
        return writeCString(payloadPointer, Number(payloadMax), message.payload);
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

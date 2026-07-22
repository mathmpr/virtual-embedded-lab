const firmwareLibraries = [
  {
    id: 'arduino-core',
    headers: ['Arduino'],
    identifiers: ['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'delay', 'delayMicroseconds', 'pulseIn', 'millis', 'micros', 'shiftOut', 'tone', 'noTone', 'random', 'randomSeed'],
    imports: ['digitalRead', 'digitalWrite', 'pinMode', 'analogRead', 'delay', 'delayMicroseconds', 'millis', 'micros', 'pulseIn', 'tone', 'noTone'],
    apis: ['pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'delay', 'delayMicroseconds', 'pulseIn', 'millis', 'micros', 'shiftOut', 'tone', 'noTone', 'random', 'randomSeed']
  },
  {
    id: 'serial',
    headers: [],
    identifiers: ['Serial'],
    imports: ['serialBegin', 'serialAvailable', 'serialRead', 'serialWrite', 'serialPrint', 'serialPrintln', 'serialPrintFloat', 'serialPrintlnFloat'],
    apis: ['Serial.begin', 'Serial.print', 'Serial.println', 'Serial.write', 'Serial.available', 'Serial.read']
  },
  {
    id: 'wire',
    headers: ['Wire'],
    identifiers: ['Wire', 'BMP280', 'ADS1015', 'ADS1115'],
    imports: ['wireBegin', 'wireBeginTransmission', 'wireWrite', 'wireEndTransmission', 'wireRequestFrom', 'wireAvailable', 'wireRead'],
    apis: ['Wire.begin', 'Wire.beginTransmission', 'Wire.write', 'Wire.endTransmission', 'Wire.requestFrom', 'Wire.available', 'Wire.read']
  },
  {
    id: 'spi',
    headers: ['SPI'],
    identifiers: ['SPI', 'MCP3008'],
    imports: ['spiBegin', 'spiTransfer'],
    apis: ['SPI.begin', 'SPI.transfer']
  },
  {
    id: 'bmp280',
    headers: ['BMP280'],
    identifiers: ['BMP280'],
    imports: ['bmp280Begin', 'bmp280ReadTemperature', 'bmp280ReadPressure'],
    apis: ['BMP280.begin', 'BMP280.readTemperature', 'BMP280.readPressure']
  },
  {
    id: 'liquid-crystal-i2c',
    headers: ['LiquidCrystal_I2C'],
    identifiers: ['LiquidCrystal_I2C'],
    imports: ['lcdBegin', 'lcdSetCursor', 'lcdPrint', 'lcdPrintInt', 'lcdClear', 'lcdBacklight'],
    apis: ['LiquidCrystal_I2C.init', 'LiquidCrystal_I2C.begin', 'LiquidCrystal_I2C.backlight', 'LiquidCrystal_I2C.noBacklight', 'LiquidCrystal_I2C.setCursor', 'LiquidCrystal_I2C.print', 'LiquidCrystal_I2C.clear']
  },
  {
    id: 'dht',
    headers: ['DHT'],
    identifiers: ['DHT', 'DHT11', 'DHT22'],
    imports: ['dhtBegin', 'dhtReadTemperature', 'dhtReadHumidity'],
    apis: ['DHT.begin', 'DHT.readTemperature', 'DHT.readHumidity']
  },
  {
    id: 'servo',
    headers: ['Servo'],
    identifiers: ['Servo'],
    imports: ['servoAttach', 'servoWrite', 'servoWriteMicroseconds'],
    apis: ['Servo.attach', 'Servo.write', 'Servo.writeMicroseconds']
  },
  {
    id: 'ads',
    headers: ['ADS1015', 'ADS1115'],
    identifiers: ['ADS1015', 'ADS1115'],
    imports: ['adcBegin', 'adcReadSingleEnded', 'adcComputeVolts'],
    apis: ['ADS1015.begin', 'ADS1015.readADC_SingleEnded', 'ADS1015.computeVolts', 'ADS1115.begin', 'ADS1115.readADC_SingleEnded', 'ADS1115.computeVolts']
  },
  {
    id: 'mcp3008',
    headers: ['MCP3008'],
    identifiers: ['MCP3008'],
    imports: ['mcp3008Begin', 'mcp3008Read'],
    apis: ['MCP3008.begin', 'MCP3008.read']
  },
  {
    id: 'wifi',
    headers: ['WiFi', 'ESP8266WiFi'],
    identifiers: ['WiFi', 'WIFI_STA', 'WL_CONNECTED', 'WiFiEventHandler'],
    imports: ['wifiMode', 'wifiBegin', 'wifiStatus', 'wifiSoftAP', 'wifiScanNetworks', 'wifiRssi', 'wifiRssiForSsid', 'wifiInternetAvailable'],
    apis: ['WiFi.mode', 'WiFi.begin', 'WiFi.status', 'WiFi.softAP', 'WiFi.scanNetworks', 'WiFi.RSSI', 'WiFi.internetAvailable', 'WiFi.disconnect', 'WiFi.SSID']
  },
  {
    id: 'tcp-client',
    headers: ['WiFiClient'],
    identifiers: ['WiFiClient'],
    imports: ['tcpConnect', 'tcpPrint', 'tcpPrintln', 'tcpAvailable', 'tcpRead', 'tcpStop', 'tcpConnected'],
    apis: ['WiFiClient.connect', 'WiFiClient.print', 'WiFiClient.println', 'WiFiClient.available', 'WiFiClient.read', 'WiFiClient.stop', 'WiFiClient.connected']
  },
  {
    id: 'mqtt',
    headers: ['AsyncMqttClient'],
    identifiers: ['AsyncMqttClient'],
    imports: ['mqttSetServer', 'mqttConnect', 'mqttDisconnect', 'mqttConnected', 'mqttSubscribe', 'mqttPublish', 'mqttReadMessage'],
    apis: ['AsyncMqttClient.setServer', 'AsyncMqttClient.onConnect', 'AsyncMqttClient.onDisconnect', 'AsyncMqttClient.onMessage', 'AsyncMqttClient.connect', 'AsyncMqttClient.connected', 'AsyncMqttClient.subscribe', 'AsyncMqttClient.publish']
  },
  {
    id: 'simple-timer',
    headers: ['SimpleTimer'],
    identifiers: ['SimpleTimer'],
    imports: [],
    apis: ['SimpleTimer.setInterval', 'SimpleTimer.run']
  }
];

export function resolveWasmShimLibraries(code) {
  const source = normalizeFirmwareSource(code);
  const included = new Set(readIncludeNames(source));

  return firmwareLibraries.filter((library) => {
    if (library.id === 'arduino-core') {
      return true;
    }

    return library.headers.some((header) => included.has(header))
      || library.identifiers.some((identifier) => referencesIdentifier(source, identifier));
  });
}

export function wasmShimImportsForLibraries(libraries) {
  return [...new Set(libraries.flatMap((library) => library.imports))];
}

export function stripRegisteredFirmwareIncludes(code, libraries = firmwareLibraries) {
  const headers = new Set(libraries.flatMap((library) => library.headers).concat('Arduino'));
  return code.replace(/^\s*#include\s+[<"]([^>"]+)\.h[>"].*$/gm, (line, header) => {
    return headers.has(header) ? '' : line;
  });
}

export function supportedWasmLibraryDocs() {
  return firmwareLibraries.map((library) => ({
    id: library.id,
    headers: [...library.headers],
    apis: [...library.apis],
    imports: [...library.imports]
  }));
}

function readIncludeNames(code) {
  return [...code.matchAll(/^\s*#include\s+[<"]([^>"]+)\.h[>"].*$/gm)].map((match) => match[1]);
}

function normalizeFirmwareSource(code) {
  return code.includes('\n') ? code : code.replaceAll('\\n', '\n');
}

function referencesIdentifier(code, identifier) {
  return new RegExp(`\\b${identifier}\\b`).test(code);
}

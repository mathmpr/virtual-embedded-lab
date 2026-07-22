import { createVirtualHttpServer } from './virtual-http-server.js';
import { createVirtualMqttBroker } from './virtual-mqtt-broker.js';

export class ArduinoRuntime {
  #pins = new Map();
  #analogPins = new Map();
  #pinEvents = [];
  #serial = {
    baudRate: null,
    events: [],
    rxBuffer: []
  };
  #i2c = {
    started: false,
    transmissionAddress: null,
    txBuffer: [],
    rxBuffer: [],
    devices: new Map()
  };
  #spi = {
    started: false,
    devices: new Map()
  };
  #dht = {
    devices: new Map()
  };
  #servos = new Map();
  #wifi = {
    environment: {
      ssid: 'VirtualLab',
      internetAvailable: false,
      strengthPercent: 0,
      networks: []
    },
    mode: 'idle',
    connected: false,
    ssid: null,
    accessPoint: null
  };
  #tcp = createTcpState();
  #mqtt = createMqttState();

  constructor(clock, scheduler, graph, options = {}) {
    this.clock = clock;
    this.scheduler = scheduler;
    this.graph = graph;
    this.componentId = options.componentId ?? null;
    this.httpServer = options.httpServer ?? createVirtualHttpServer(options.http ?? {});
    this.mqttClientId = options.componentId ?? 'default';
    this.mqttBroker = options.mqttBroker ?? createMqttBroker(options.mqtt ?? {}, this.mqttClientId);
    this.#mqtt = createMqttState();
  }

  pinMode(pin, mode) {
    this.#pins.set(pin, { ...this.getPin(pin), mode });
  }

  digitalWrite(pin, value) {
    const pinState = this.getPin(pin);

    if (pinState.mode !== 'OUTPUT') {
      throw new Error(`Cannot digitalWrite to pin ${pin} configured as ${pinState.mode}`);
    }

    this.#pins.set(pin, { ...pinState, value });
    this.#pinEvents.push({
      pin,
      value,
      timeUs: this.clock.nowUs()
    });
    this.graph.driveArduinoPin(pin, value, this.componentId);
  }

  driveInput(pin, value) {
    this.#pins.set(pin, { ...this.getPin(pin), value });
  }

  digitalRead(pin) {
    return this.getPin(pin).value;
  }

  driveAnalogInput(pin, value, metadata = {}) {
    const maxRaw = Number.isFinite(Number(metadata.maxRaw)) ? Number(metadata.maxRaw) : 1023;
    const normalizedValue = Math.max(0, Math.min(maxRaw, Math.round(Number(value) || 0)));
    this.#analogPins.set(pin, {
      value: normalizedValue,
      voltageVolts: Number.isFinite(metadata.voltageVolts) ? metadata.voltageVolts : null,
      resistanceOhms: Number.isFinite(metadata.resistanceOhms) ? metadata.resistanceOhms : null,
      sourceComponentId: metadata.sourceComponentId ?? null
    });
  }

  analogRead(pin) {
    return this.#analogPins.get(pin)?.value ?? 0;
  }

  micros() {
    return this.clock.nowUs();
  }

  millis() {
    return Math.floor(this.clock.nowUs() / 1000);
  }

  delayMicroseconds(microseconds) {
    this.scheduler.runUntil(this.clock.nowUs() + microseconds);
  }

  delay(milliseconds) {
    this.delayMicroseconds(milliseconds * 1000);
  }

  tone(pin, frequency) {
    const normalizedPin = Number(pin);
    const pinState = this.getPin(normalizedPin);

    this.#pins.set(normalizedPin, { ...pinState, mode: 'OUTPUT', value: 'HIGH', frequencyHz: Number(frequency) || 0 });
    this.#pinEvents.push({
      pin: normalizedPin,
      value: 'HIGH',
      frequencyHz: Number(frequency) || 0,
      timeUs: this.clock.nowUs()
    });
    this.graph.driveArduinoPin(normalizedPin, 'HIGH', this.componentId);
  }

  noTone(pin) {
    const normalizedPin = Number(pin);
    const pinState = this.getPin(normalizedPin);

    this.#pins.set(normalizedPin, { ...pinState, mode: 'OUTPUT', value: 'LOW', frequencyHz: 0 });
    this.#pinEvents.push({
      pin: normalizedPin,
      value: 'LOW',
      frequencyHz: 0,
      timeUs: this.clock.nowUs()
    });
    this.graph.driveArduinoPin(normalizedPin, 'LOW', this.componentId);
  }

  pulseIn(pin, value, timeoutMicroseconds = 1_000_000) {
    const timeoutAt = this.clock.nowUs() + timeoutMicroseconds;

    while (this.digitalRead(pin) === value && this.clock.nowUs() < timeoutAt) {
      if (!this.scheduler.runNext()) {
        this.scheduler.runUntil(timeoutAt);
      }
    }

    while (this.digitalRead(pin) !== value && this.clock.nowUs() < timeoutAt) {
      if (!this.scheduler.runNext()) {
        this.scheduler.runUntil(timeoutAt);
      }
    }

    if (this.digitalRead(pin) !== value) {
      return 0;
    }

    const startedAt = this.clock.nowUs();

    while (this.digitalRead(pin) === value && this.clock.nowUs() < timeoutAt) {
      if (!this.scheduler.runNext()) {
        this.scheduler.runUntil(timeoutAt);
      }
    }

    return this.clock.nowUs() - startedAt;
  }

  getPin(pin) {
    return this.#pins.get(pin) ?? { mode: 'INPUT', value: 'LOW' };
  }

  getPinsSnapshot() {
    return Object.fromEntries([...this.#pins.entries()].map(([pin, state]) => [pin, { ...state }]));
  }

  getAnalogPinsSnapshot() {
    return Object.fromEntries([...this.#analogPins.entries()].map(([pin, state]) => [pin, { ...state }]));
  }

  getPinEventsSnapshot() {
    return this.#pinEvents.map((event) => ({ ...event }));
  }

  drainPinEvents() {
    const events = this.getPinEventsSnapshot();
    this.#pinEvents = [];
    return events;
  }

  serialBegin(baudRate) {
    const normalizedBaudRate = Number(baudRate);

    this.#serial.baudRate = normalizedBaudRate;
    this.#serial.events.push({
      direction: 'TX',
      type: 'control',
      baudRate: normalizedBaudRate,
      data: `Serial.begin(${normalizedBaudRate})`,
      timeUs: this.clock.nowUs()
    });
  }

  serialPrint(value, newline = false) {
    this.#serial.events.push({
      direction: 'TX',
      type: 'data',
      baudRate: this.#serial.baudRate,
      data: `${value}${newline ? '\n' : ''}`,
      timeUs: this.clock.nowUs()
    });
  }

  serialWrite(value) {
    const byte = Number(value) & 0xff;

    this.#serial.events.push({
      direction: 'TX',
      type: 'data',
      baudRate: this.#serial.baudRate,
      data: String.fromCharCode(byte),
      byte,
      timeUs: this.clock.nowUs()
    });
  }

  serialReceive(message) {
    const text = String(typeof message === 'object' && message !== null ? message.data : message);
    const baudRate = typeof message === 'object' && message !== null
      ? Number(message.baudRate ?? this.#serial.baudRate)
      : this.#serial.baudRate;

    for (const char of text) {
      this.#serial.rxBuffer.push(char.charCodeAt(0));
    }

    this.#serial.events.push({
      direction: 'RX',
      type: 'data',
      baudRate: Number.isFinite(baudRate) ? baudRate : null,
      data: text,
      timeUs: this.clock.nowUs()
    });
  }

  serialAvailable() {
    return this.#serial.rxBuffer.length;
  }

  serialRead() {
    return this.#serial.rxBuffer.shift() ?? -1;
  }

  wireBegin() {
    this.#i2c.started = true;
  }

  wireBeginTransmission(address) {
    this.#i2c.transmissionAddress = Number(address);
    this.#i2c.txBuffer = [];
  }

  wireWrite(value) {
    this.#i2c.txBuffer.push(Number(value) & 0xff);
    return 1;
  }

  wireEndTransmission() {
    const device = this.#i2c.devices.get(this.#i2c.transmissionAddress);
    this.#i2c.transmissionAddress = null;
    return device ? 0 : 2;
  }

  wireRequestFrom(address, count) {
    const device = this.#i2c.devices.get(Number(address));
    const bytes = typeof device?.readBytes === 'function' ? device.readBytes(Number(count), this.#i2c.txBuffer) : [];

    this.#i2c.rxBuffer = bytes.slice(0, Number(count)).map((value) => Number(value) & 0xff);
    return this.#i2c.rxBuffer.length;
  }

  wireAvailable() {
    return this.#i2c.rxBuffer.length;
  }

  wireRead() {
    return this.#i2c.rxBuffer.shift() ?? -1;
  }

  registerI2cDevice(address, device) {
    this.#i2c.devices.set(Number(address), { ...device, address: Number(address) });
  }

  lcdBegin(address, columns, rows) {
    const display = this.#lcdDisplay(address);

    if (!display) {
      return false;
    }

    display.columns = Math.max(1, Number(columns) || display.columns || 16);
    display.rows = Math.max(1, Number(rows) || display.rows || 2);
    display.cursorColumn = 0;
    display.cursorRow = 0;
    display.buffer = lcdBuffer(display);
    syncLcdDisplayComponent(display);
    return true;
  }

  lcdSetCursor(address, column, row) {
    const display = this.#lcdDisplay(address);

    if (!display) {
      return;
    }

    display.cursorColumn = clampInteger(column, 0, Math.max(0, display.columns - 1));
    display.cursorRow = clampInteger(row, 0, Math.max(0, display.rows - 1));
  }

  lcdPrint(address, value) {
    const display = this.#lcdDisplay(address);

    if (!display) {
      return;
    }

    for (const char of String(value ?? '')) {
      if (display.cursorRow >= display.rows || display.cursorColumn >= display.columns) {
        break;
      }

      display.buffer[display.cursorRow][display.cursorColumn] = char;
      display.cursorColumn++;
    }

    syncLcdDisplayComponent(display);
  }

  lcdClear(address) {
    const display = this.#lcdDisplay(address);

    if (!display) {
      return;
    }

    display.cursorColumn = 0;
    display.cursorRow = 0;
    display.buffer = lcdBuffer(display);
    syncLcdDisplayComponent(display);
  }

  lcdSetBacklight(address, enabled) {
    const display = this.#lcdDisplay(address);

    if (!display) {
      return;
    }

    display.backlight = Boolean(enabled);
    syncLcdDisplayComponent(display);
  }

  #lcdDisplay(address) {
    const device = this.#i2c.devices.get(Number(address));
    return device?.type === 'lcd-16x2-i2c' ? device : null;
  }

  bmp280Begin(address) {
    return this.#i2c.devices.get(Number(address))?.type === 'bmp280';
  }

  bmp280ReadTemperature(address) {
    const device = this.#i2c.devices.get(Number(address));
    return typeof device?.readTemperature === 'function' ? device.readTemperature() : 0;
  }

  bmp280ReadPressure(address) {
    const device = this.#i2c.devices.get(Number(address));
    return typeof device?.readPressure === 'function' ? device.readPressure() : 0;
  }

  adcBegin(address, expectedType) {
    const device = this.#i2c.devices.get(Number(address));
    return device?.type === expectedType;
  }

  adcReadSingleEnded(address, channel) {
    const device = this.#i2c.devices.get(Number(address));
    return typeof device?.readChannel === 'function' ? device.readChannel(Number(channel)) : 0;
  }

  adcComputeVolts(address, raw) {
    const device = this.#i2c.devices.get(Number(address));
    return typeof device?.computeVolts === 'function' ? device.computeVolts(Number(raw)) : 0;
  }

  spiBegin() {
    this.#spi.started = true;
  }

  spiTransfer(value) {
    return Number(value) & 0xff;
  }

  registerSpiDevice(chipSelectPin, device) {
    this.#spi.devices.set(Number(chipSelectPin), { ...device, chipSelectPin: Number(chipSelectPin) });
  }

  registerDhtSensor(pin, device) {
    this.#dht.devices.set(Number(pin), { ...device, pin: Number(pin) });
  }

  dhtBegin(pin, type) {
    const device = this.#dht.devices.get(Number(pin));
    return Boolean(device && (!Number.isInteger(device.type) || Number(device.type) === Number(type)));
  }

  dhtReadTemperature(pin) {
    const device = this.#dht.devices.get(Number(pin));
    return typeof device?.readTemperature === 'function' ? device.readTemperature() : 0;
  }

  dhtReadHumidity(pin) {
    const device = this.#dht.devices.get(Number(pin));
    return typeof device?.readHumidity === 'function' ? device.readHumidity() : 0;
  }

  registerServoMotor(pin, servo) {
    this.#servos.set(Number(pin), { ...servo, pin: Number(pin) });
  }

  servoAttach(pin) {
    const servo = this.#servos.get(Number(pin));

    if (!servo) {
      return false;
    }

    servo.component.properties[servo.attachedProperty] = true;
    return true;
  }

  servoWrite(pin, angle) {
    const servo = this.#servos.get(Number(pin));

    if (!servo) {
      return;
    }

    servo.component.properties[servo.angleProperty] = clamp(Number(angle), 0, 180);
  }

  servoWriteMicroseconds(pin, pulseUs) {
    const servo = this.#servos.get(Number(pin));

    if (!servo) {
      return;
    }

    const minPulse = Number(servo.component.properties[servo.minPulseProperty] ?? 544);
    const maxPulse = Number(servo.component.properties[servo.maxPulseProperty] ?? 2400);
    const normalized = (Number(pulseUs) - minPulse) / Math.max(1, maxPulse - minPulse);

    this.servoWrite(pin, normalized * 180);
  }

  mcp3008Begin(chipSelectPin) {
    return this.#spi.devices.get(Number(chipSelectPin))?.type === 'mcp3008';
  }

  mcp3008Read(chipSelectPin, channel) {
    const device = this.#spi.devices.get(Number(chipSelectPin));
    return typeof device?.readChannel === 'function' ? device.readChannel(Number(channel)) : 0;
  }

  configureWifiEnvironment(environment) {
    const networks = Array.isArray(environment.networks) && environment.networks.length > 0
      ? environment.networks
      : [environment];

    this.#wifi.environment = {
      ssid: String(networks[0]?.ssid ?? environment.ssid ?? 'VirtualLab'),
      internetAvailable: Boolean(networks[0]?.internetAvailable ?? networks[0]?.connected ?? environment.internetAvailable ?? environment.connected),
      strengthPercent: normalizeStrength(networks[0]?.strengthPercent ?? environment.strengthPercent),
      networks: networks.map((network) => ({
        ssid: String(network.ssid ?? 'VirtualLab'),
        internetAvailable: Boolean(network.internetAvailable ?? network.connected),
        strengthPercent: normalizeStrength(network.strengthPercent)
      }))
    };

    if (this.#wifi.mode === 'station') {
      this.#wifi.connected = this.#canJoinWifi(this.#wifi.ssid);
    }
  }

  wifiMode(mode) {
    this.#wifi.mode = normalizeWifiMode(mode);
    if (this.#wifi.mode !== 'station') {
      this.#wifi.connected = this.#wifi.mode === 'ap';
    }
  }

  wifiBegin(ssid, password = '') {
    this.#wifi.mode = 'station';
    this.#wifi.ssid = String(ssid ?? '');
    this.#wifi.password = String(password ?? '');
    this.#wifi.connected = this.#canJoinWifi(this.#wifi.ssid);
    return this.wifiStatus();
  }

  wifiStatus() {
    return this.#wifi.connected ? wifiStatusCodes.WL_CONNECTED : wifiStatusCodes.WL_DISCONNECTED;
  }

  wifiSoftAp(ssid, password = '') {
    this.#wifi.mode = 'ap';
    this.#wifi.accessPoint = {
      ssid: String(ssid ?? ''),
      password: String(password ?? '')
    };
    this.#wifi.connected = true;
    return true;
  }

  wifiScanNetworks() {
    return this.#availableWifiNetworks().length;
  }

  wifiRssi() {
    if (this.#wifi.mode === 'ap') {
      return signalStrengthToRssi(this.#wifi.environment.strengthPercent);
    }

    if (!this.#wifi.connected) {
      return 0;
    }

    return signalStrengthToRssi(this.#connectedWifiNetwork()?.strengthPercent ?? 0);
  }

  wifiRssiForSsid(ssid) {
    return signalStrengthToRssi(this.#wifiNetworkForSsid(ssid)?.strengthPercent ?? 0);
  }

  wifiInternetAvailable() {
    if (this.#wifi.mode === 'ap') {
      return false;
    }

    return Boolean(this.#connectedWifiNetwork()?.internetAvailable);
  }

  tcpConnect(host, port) {
    const normalizedHost = String(host ?? '').trim();
    const normalizedPort = Number(port);

    this.#tcp = createTcpState({
      connected: this.#wifi.connected && this.wifiInternetAvailable() && normalizedHost.length > 0,
      host: normalizedHost,
      port: Number.isFinite(normalizedPort) ? normalizedPort : 0
    });

    return this.#tcp.connected ? 1 : 0;
  }

  tcpPrint(data) {
    if (!this.#tcp.connected) {
      return 0;
    }

    const text = String(data ?? '');
    this.#tcp.txBuffer += text;
    this.#prepareTcpResponseIfReady();
    return text.length;
  }

  tcpPrintln(data = '') {
    return this.tcpPrint(`${data}\r\n`);
  }

  tcpAvailable() {
    return this.#tcp.rxBuffer.length;
  }

  tcpRead() {
    return this.#tcp.rxBuffer.shift() ?? -1;
  }

  tcpStop() {
    this.#tcp.connected = false;
  }

  tcpConnected() {
    return this.#tcp.connected ? 1 : 0;
  }

  mqttSetServer(host, port) {
    this.#mqtt.host = String(host ?? '');
    this.#mqtt.port = Number(port) || 1883;
  }

  mqttConnect() {
    this.#mqtt.connected = this.mqttBroker.connect({
      clientId: this.mqttClientId,
      host: this.#mqtt.host,
      port: this.#mqtt.port
    });

    return this.#mqtt.connected ? 1 : 0;
  }

  mqttDisconnect() {
    this.mqttBroker.disconnect(this.mqttClientId);
    this.#mqtt.connected = false;
  }

  mqttConnected() {
    this.#mqtt.connected = this.mqttBroker.connected(this.mqttClientId);
    return this.#mqtt.connected ? 1 : 0;
  }

  mqttSubscribe(topic) {
    return this.mqttBroker.subscribe(this.mqttClientId, String(topic ?? ''));
  }

  mqttPublish(topic, qos, retain, payload) {
    return this.mqttBroker.publish({
      clientId: this.mqttClientId,
      topic,
      qos,
      retain,
      payload
    });
  }

  mqttReadSubscribedMessage(topic) {
    return this.mqttBroker.readSubscribedMessage(this.mqttClientId, String(topic ?? ''));
  }

  getWifiSnapshot() {
    return {
      environment: { ...this.#wifi.environment },
      mode: this.#wifi.mode,
      connected: this.#wifi.connected,
      ssid: this.#wifi.ssid,
      accessPoint: this.#wifi.accessPoint ? { ...this.#wifi.accessPoint } : null,
      status: this.wifiStatus(),
      rssi: this.wifiRssi()
    };
  }

  getMqttSnapshot() {
    return this.mqttBroker.snapshot();
  }

  getI2cSnapshot() {
    return {
      started: this.#i2c.started,
      devices: [...this.#i2c.devices.entries()].map(([address, device]) => ({
        address,
        type: device.type
      }))
    };
  }

  getSpiSnapshot() {
    return {
      started: this.#spi.started,
      devices: [...this.#spi.devices.entries()].map(([chipSelectPin, device]) => ({
        chipSelectPin,
        type: device.type
      }))
    };
  }

  getSerialSnapshot() {
    return {
      baudRate: this.#serial.baudRate,
      events: this.#serial.events.map((event) => ({ ...event })),
      supportedBaudRates: supportedSerialBaudRates()
    };
  }

  drainSerialEvents() {
    const events = this.#serial.events.map((event) => ({ ...event }));
    this.#serial.events = [];
    return {
      baudRate: this.#serial.baudRate,
      events,
      supportedBaudRates: supportedSerialBaudRates()
    };
  }

  #canJoinWifi(ssid) {
    return Boolean(this.#wifiNetworkForSsid(ssid)?.strengthPercent > 0);
  }

  #availableWifiNetworks() {
    return this.#wifi.environment.networks.filter((network) => network.strengthPercent > 0);
  }

  #wifiNetworkForSsid(ssid) {
    const normalizedSsid = String(ssid ?? '');
    return this.#wifi.environment.networks.find((network) => {
      return (!normalizedSsid || network.ssid === normalizedSsid) && network.strengthPercent > 0;
    }) ?? null;
  }

  #connectedWifiNetwork() {
    return this.#wifiNetworkForSsid(this.#wifi.ssid);
  }

  #prepareTcpResponseIfReady() {
    if (this.#tcp.responded || !this.httpServer.canRespond(this.#tcp.txBuffer)) {
      return;
    }

    const response = this.httpServer.respond({
      host: this.#tcp.host,
      port: this.#tcp.port,
      request: this.#tcp.txBuffer
    });
    this.#tcp.rxBuffer = [...response].map((char) => char.charCodeAt(0));
    this.#tcp.responded = true;
    this.#tcp.connected = false;
  }
}

export function supportedSerialBaudRates() {
  return [300, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 230400, 250000];
}

export const wifiStatusCodes = {
  WL_IDLE_STATUS: 0,
  WL_NO_SSID_AVAIL: 1,
  WL_SCAN_COMPLETED: 2,
  WL_CONNECTED: 3,
  WL_CONNECT_FAILED: 4,
  WL_CONNECTION_LOST: 5,
  WL_DISCONNECTED: 6
};

function normalizeWifiMode(mode) {
  if (mode === 1 || mode === 'WIFI_STA' || mode === 'station') {
    return 'station';
  }

  if (mode === 2 || mode === 'WIFI_AP' || mode === 'ap') {
    return 'ap';
  }

  if (mode === 3 || mode === 'WIFI_AP_STA' || mode === 'station-ap') {
    return 'station-ap';
  }

  return 'idle';
}

function signalStrengthToRssi(strengthPercent) {
  return Math.round(-100 + normalizeStrength(strengthPercent) * 0.65);
}

function normalizeStrength(strengthPercent) {
  return Math.max(0, Math.min(100, Number(strengthPercent ?? 0)));
}

function createTcpState(overrides = {}) {
  return {
    connected: false,
    host: null,
    port: 0,
    txBuffer: '',
    rxBuffer: [],
    responded: false,
    ...overrides
  };
}

function createMqttState(overrides = {}) {
  return {
    host: 'mqtt.local',
    port: 1883,
    connected: false,
    ...overrides
  };
}

function createMqttBroker(config, clientId) {
  if (config.mode === 'real' && typeof XMLHttpRequest === 'function') {
    return createRealMqttBridge(clientId);
  }

  return createVirtualMqttBroker(config);
}

function createRealMqttBridge(clientId) {
  const published = [];
  const subscriptions = new Set();
  const errors = [];
  let connected = false;
  let host = '';
  let port = 1883;

  return {
    connect(request) {
      host = String(request.host ?? '');
      port = Number(request.port ?? 1883);
      const result = postMqttBridge('connect', { clientId, host, port });

      connected = result.ok === true && result.connected === true;
      recordBridgeError(errors, 'connect', result);
      return connected;
    },
    disconnect() {
      const result = postMqttBridge('disconnect', { clientId });
      recordBridgeError(errors, 'disconnect', result);
      connected = false;
    },
    connected() {
      const result = postMqttBridge('connected', { clientId });
      connected = result.ok === true && result.connected === true;
      recordBridgeError(errors, 'connected', result);
      return connected;
    },
    subscribe(_clientId, topic) {
      const result = postMqttBridge('subscribe', { clientId, topic });

      if (result.ok === true) {
        subscriptions.add(String(topic ?? ''));
      }

      recordBridgeError(errors, 'subscribe', result);
      return result.packetId ?? 0;
    },
    publish({ topic, qos = 0, retain = false, payload = '' }) {
      const result = postMqttBridge('publish', { clientId, topic, qos, retain, payload });

      if (result.ok === true) {
        published.push({ clientId, topic, qos, retain, payload, direction: 'TX' });
      }

      recordBridgeError(errors, 'publish', result);
      return result.packetId ?? 0;
    },
    readSubscribedMessage(_clientId, topic) {
      const result = postMqttBridge('drain', { clientId, topic });

      recordBridgeError(errors, 'drain', result);
      return result.ok === true ? result.messages?.[0] ?? null : null;
    },
    snapshot() {
      return {
        mode: 'real',
        brokers: [{ host, port, online: connected, messages: [] }],
        sessions: [{ clientId, host, port, connected, subscriptions: [...subscriptions] }],
        published: published.map((message) => ({ ...message })),
        errors: errors.map((error) => ({ ...error }))
      };
    }
  };
}

function recordBridgeError(errors, action, result) {
  if (result.ok === true) {
    return;
  }

  const error = String(result.error ?? `MQTT bridge action failed: ${action}`);
  const key = `${action}:${error}`;

  if (!errors.some((item) => item.key === key)) {
    errors.push({ key, action, error });
  }
}

function postMqttBridge(action, payload) {
  const request = new XMLHttpRequest();

  try {
    request.open('POST', `/api/network/mqtt/${action}`, false);
    request.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    request.send(JSON.stringify(payload));

    if (request.status < 200 || request.status >= 300) {
      return { ok: false, error: request.statusText };
    }

    return JSON.parse(request.responseText || '{"ok":false}');
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function lcdBuffer(display) {
  return Array.from({ length: display.rows }, () => Array.from({ length: display.columns }, () => ' '));
}

function syncLcdDisplayComponent(display) {
  const lineProperties = display.lineProperties ?? ['line1', 'line2'];

  for (let row = 0; row < lineProperties.length; row++) {
    display.component.properties[lineProperties[row]] = (display.buffer[row] ?? []).join('').trimEnd();
  }

  if (display.backlightProperty) {
    display.component.properties[display.backlightProperty] = Boolean(display.backlight);
  }
}

function clampInteger(value, min, max) {
  const normalized = Math.trunc(Number(value) || 0);
  return Math.max(min, Math.min(max, normalized));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

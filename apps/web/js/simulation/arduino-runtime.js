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

  constructor(clock, scheduler, graph, options = {}) {
    this.clock = clock;
    this.scheduler = scheduler;
    this.graph = graph;
    this.componentId = options.componentId ?? null;
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
    const normalizedValue = Math.max(0, Math.min(1023, Math.round(Number(value) || 0)));
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

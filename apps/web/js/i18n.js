export const defaultLocale = 'pt-BR';
export const localeStorageKey = 'virtual-embedded-lab.locale';
export const supportedLocales = ['pt-BR', 'en', 'es'];

const ptBRMessages = {
  'Virtual Embedded Lab': 'Laboratório Embarcado Virtual',
  'Build without components': 'Build without components',
  Language: 'Idioma',
  Examples: 'Exemplos',
  Components: 'Componentes',
  'Loading official components...': 'Carregando componentes oficiais...',
  Save: 'Salvar',
  Load: 'Carregar',
  Export: 'Exportar',
  Import: 'Importar',
  Properties: 'Propriedades',
  'Select a component or wire.': 'Selecione um componente ou fio.',
  Signals: 'Sinais',
  Code: 'Código',
  Console: 'Console',
  Problems: 'Problemas',
  'Runtime ready.': 'Runtime pronto.',
  'Active firmware': 'Firmware ativo',
  'Arduino code editor': 'Editor de código Arduino',
  'Resize bottom panel': 'Redimensionar painel inferior',
  'Target RX Serial': 'Destino RX Serial',
  'Serial baud rate': 'Taxa de baud Serial',
  Send: 'Enviar',
  'No serial messages.': 'Nenhuma mensagem serial.',
  'Load a complete project with board and code.': 'Carregue um projeto completo com board e código.',
  Close: 'Fechar',
  'Loading examples...': 'Carregando exemplos...',
  'Circuit not simulated yet.': 'Circuito ainda não simulado.',
  'Enable component audio': 'Ativar áudio dos componentes',
  'No examples found.': 'Nenhum exemplo encontrado.',
  'Select a component to view derived connection signals.': 'Selecione um componente para ver sinais derivados das conexões.',
  'This component does not have derived project signals yet.': 'Este componente ainda não possui sinais derivados do projeto.',
  'Terminals and connections': 'Terminais e conexões',
  Electrical: 'Elétrico',
  Voltage: 'Tensão',
  Current: 'Corrente',
  Power: 'Potência',
  'Loading example...': 'Carregando exemplo...',
  'Failed to load official components': 'Falha ao carregar componentes oficiais',
  'Failed to load examples': 'Falha ao carregar exemplos',
  'Failed to load default example': 'Falha ao carregar exemplo default',
  'No project loaded.': 'Nenhum projeto carregado.',
  'Project saved in browser': 'Projeto salvo no navegador',
  components: 'componentes',
  'electrical connections': 'conexões elétricas',
  'environment connections': 'conexões ambientais',
  'No project saved in browser.': 'Nenhum projeto salvo no navegador.',
  'Failed to load saved project': 'Falha ao carregar projeto salvo',
  'Project exported as JSON.': 'Projeto exportado como JSON.',
  'Failed to import project': 'Falha ao importar projeto',
  'Project loaded': 'Projeto carregado',
  'Simulation blocked: Clang found a firmware error.': 'Simulação bloqueada: Clang encontrou erro no firmware.',
  'Simulation blocked: WASM firmware was not compiled.': 'Simulação bloqueada: firmware WASM não foi compilado.',
  'No critical problems reported by the kernel.': 'Nenhum problema crítico reportado pelo kernel.',
  'Simulation failed': 'Falha de simulação',
  'Simulation paused.': 'Simulação pausada.',
  'Audio Off': 'Áudio desligado',
  'Audio On': 'Áudio ligado',
  Run: 'Executar',
  Pause: 'Pausar',
  Reset: 'Reiniciar',
  Undo: 'Desfazer',
  Redo: 'Refazer',
  Clear: 'Limpar',
  'Board visual': 'Placa visual',
  'Drag components here': 'Arraste componentes aqui',
  'Auto-scroll Serial': 'Rolagem automática Serial',
  'Auto-scroll Serial enabled': 'Rolagem automática Serial ativada',
  'Auto-scroll Serial disabled': 'Rolagem automática Serial desativada',
  Press: 'Pressionar',
  ON: 'Ligado',
  OFF: 'Desligado',
  HIGH: 'Alto',
  LOW: 'Baixo',
  WET: 'Molhado',
  DRY: 'Seco',
  DARK: 'Escuro',
  DIM: 'Meia luz',
  BRIGHT: 'Claro',
  raw: 'bruto',
  '-- raw': '-- bruto',
  serial: 'serial',
  'no baud': 'sem baud',

  Boards: 'Placas',
  Electronic: 'Eletrônica',
  Electronics: 'Eletrônica',
  Inputs: 'Entradas',
  Outputs: 'Saídas',
  Displays: 'Displays',
  'LED Displays': 'Displays LED',
  ICs: 'CIs',
  Sensors: 'Sensores',
  Actuators: 'Atuadores',
  Environment: 'Ambiente',
  'Shift Registers': 'Registradores de deslocamento',
  ADCs: 'ADCs',
  Control: 'Controle',
  Power: 'Energia',
  Passive: 'Passivos',
  Wireless: 'Sem fio',
  Climate: 'Clima',
  Water: 'Água',
  Buttons: 'Botões',
  Capacitors: 'Capacitores',
  LEDs: 'LEDs',
  Modules: 'Módulos',
  Motors: 'Motores',
  Relays: 'Relés',
  Resistors: 'Resistores',
  Weather: 'Clima',

  'Arduino UNO': 'Arduino UNO',
  'Arduino Nano': 'Arduino Nano',
  'ESP32 DevKitC V4': 'ESP32 DevKitC V4',
  'ESP8266 NodeMCU': 'ESP8266 NodeMCU',
  '7 Segment': 'Display LED de 7 segmentos',
  '7-Segment LED Display': 'Display LED de 7 segmentos',
  '74HC595 Shift Register': 'Registrador de deslocamento 74HC595',
  'Pull-up Button': 'Botão pull-up',
  Button: 'Botão',
  'Push Button': 'Botão',
  'Momentary Button': 'Botão momentâneo',
  'Blue LED': 'LED azul',
  'Red LED': 'LED vermelho',
  'Green LED': 'LED verde',
  'Yellow LED': 'LED amarelo',
  Buzzer: 'Buzzer',
  Resistor: 'Resistor',
  Capacitor: 'Capacitor',
  'LCD 16x2 I2C': 'LCD 16x2 I2C',
  'Servo Motor': 'Servo motor',
  'HC-SR04 Ultrasonic Sensor': 'Sensor ultrassônico HC-SR04',
  'DHT11 Sensor': 'Sensor DHT11',
  'DHT22 Sensor': 'Sensor DHT22',
  'BMP280 Sensor': 'Sensor BMP280',
  'FC-37 Rain Sensor': 'Sensor de chuva FC-37',
  'LDR Light Sensor': 'Sensor de luz LDR',
  'Wi-Fi Signal': 'Sinal Wi-Fi',
  'Light Level': 'Nível de luz',
  'Rain Toggle': 'Controle de chuva',
  'Distance Range': 'Faixa de distância',
  'Climate Source': 'Fonte de clima',
  'Water Reservoir': 'Reservatório de água',
  'Water Pump': 'Bomba d’água',
  'Solid State Relay': 'Relé de estado sólido',
  '1-Channel Solid State Relay': 'Relé de estado sólido de 1 canal',
  'Analog Voltage Source': 'Fonte de tensão analógica',
  'MCP3008 ADC': 'ADC MCP3008',
  'ADS1015 ADC': 'ADC ADS1015',
  'ADS1115 ADC': 'ADC ADS1115',
  ADS1015: 'ADS1015',
  ADS1115: 'ADS1115',

  'Common cathode': 'Cátodo comum',
  'Common anode': 'Ânodo comum',
  Catodo: 'Cátodo',
  Anodo: 'Ânodo',
  Cathode: 'Cátodo',
  Anode: 'Ânodo',
  '3.3V logic / Wi-Fi': 'Lógica 3,3 V / Wi-Fi',
  '3.3V logic / Wi-Fi / Bluetooth': 'Lógica 3,3 V / Wi-Fi / Bluetooth',
  '5V logic / GPIO': 'Lógica 5 V / GPIO',
  '10-bit SPI ADC': 'ADC SPI de 10 bits',
  '12-bit ADC': 'ADC de 12 bits',
  '12-bit I2C ADC': 'ADC I2C de 12 bits',
  '16-bit ADC': 'ADC de 16 bits',
  '16-bit I2C ADC': 'ADC I2C de 16 bits',
  '16x2 I2C display': 'Display I2C 16x2',
  '5V logic': 'Lógica 5 V',
  '3.3V logic': 'Lógica 3,3 V',
  'No component': 'Sem componente',
  'Active HIGH': 'Ativo em HIGH',
  'Active Type': 'Tipo ativo',
  Analog: 'Analógico',
  Addr: 'Endereço',
  Attached: 'Conectado',
  Backlight: 'Luz de fundo',
  'Bluetooth Enabled': 'Bluetooth ativado',
  'BMP280 Pressure/Temperature': 'BMP280 pressão/temperatura',
  Connected: 'Conectado',
  'Character LCD': 'LCD de caracteres',
  Cap: 'Cap.',
  'FC-37 Rain': 'Chuva FC-37',
  Flow: 'Vazão',
  Freq: 'Freq.',
  'High sensitivity': 'Alta sensibilidade',
  'I2C 0x27': 'I2C 0x27',
  'I2C 0x3F': 'I2C 0x3F',
  'I2C 0x76': 'I2C 0x76',
  'I2C 0x77': 'I2C 0x77',
  'LDR Light': 'Luz LDR',
  Light: 'Luz',
  'Light Environment': 'Ambiente de luz',
  'Low sensitivity': 'Baixa sensibilidade',
  Mode: 'Modo',
  Pump: 'Bomba',
  Rain: 'Chuva',
  Servo: 'Servo',
  Sound: 'Som',
  'Standard 5 mm': 'Padrão 5 mm',
  Tank: 'Tanque',
  'Water Tank': 'Tanque de água',
  off: 'desligado',
  '5V Power On LED; nao e controlado por GPIO.': 'LED de energia 5 V; não é controlado por GPIO.',
  'LED built-in comum do ESP8266 NodeMCU ligado ao GPIO2/D4, ativo em LOW.': 'LED embutido comum do ESP8266 NodeMCU ligado ao GPIO2/D4, ativo em LOW.'
};

const propertyMessages = {
  active: 'Ativo',
  activeType: 'Tipo ativo',
  activeHigh: 'Ativo em alto',
  activeLow: 'Ativo em baixo',
  address: 'Endereço',
  angleDegrees: 'Ângulo',
  attached: 'Conectado',
  backlight: 'Luz de fundo',
  bluetoothEnabled: 'Bluetooth ativado',
  brightResistanceOhms: 'Resistência em luz forte',
  capacitanceMicrofarads: 'Capacitância',
  capacityLiters: 'Capacidade',
  clearActiveLow: 'Clear ativo em baixo',
  clockMHz: 'Clock',
  columns: 'Colunas',
  commonType: 'Tipo comum',
  connected: 'Conectado',
  currentAmps: 'Corrente',
  currentLiters: 'Volume atual',
  darkResistanceOhms: 'Resistência no escuro',
  dryAnalogValue: 'Valor analógico seco',
  enabled: 'Ativado',
  flowLitersPerHour: 'Vazão',
  forwardVoltage: 'Tensão direta',
  forwardVoltageVolts: 'Tensão direta',
  frequencyHz: 'Frequência',
  gain: 'Ganho',
  gamma: 'Gama',
  humidityPercent: 'Umidade',
  i2cAddress: 'Endereço I2C',
  inputLevel: 'Nível de entrada',
  intensityPercent: 'Intensidade',
  latchedValue: 'Valor travado',
  line1: 'Linha 1',
  line2: 'Linha 2',
  logicVoltage: 'Tensão lógica',
  maxCm: 'Distância máxima',
  maxClockHz: 'Clock máximo',
  maxPulseUs: 'Pulso máximo',
  maximumCurrent: 'Corrente máxima',
  maximumPowerWatts: 'Potência máxima',
  maximumVoltageVolts: 'Tensão máxima',
  minCm: 'Distância mínima',
  minPulseUs: 'Pulso mínimo',
  minimumVisibleCurrent: 'Corrente mínima visível',
  mode: 'Modo',
  noLoadCurrentAmps: 'Corrente sem carga',
  nominalVoltageVolts: 'Tensão nominal',
  outputEnabled: 'Saída ativada',
  overflowActive: 'Overflow ativo',
  oversampling: 'Oversampling',
  percent: 'Percentual',
  pressureHpa: 'Pressão',
  pressureOffsetHpa: 'Offset de pressão',
  pressed: 'Pressionado',
  ratedCurrentAmps: 'Corrente nominal',
  ratedVoltageVolts: 'Tensão nominal',
  readIntervalMs: 'Intervalo de leitura',
  referenceVoltageVolts: 'Tensão de referência',
  recommendedCurrent: 'Corrente recomendada',
  recommendedCurrentAmps: 'Corrente recomendada',
  responseMs: 'Tempo de resposta',
  resolutionBits: 'Resolução',
  resistanceOhms: 'Resistência',
  rows: 'Linhas',
  sampleRateSps: 'Taxa de amostragem',
  segmentA: 'Segmento A',
  segmentB: 'Segmento B',
  segmentC: 'Segmento C',
  segmentD: 'Segmento D',
  segmentDp: 'Segmento DP',
  segmentE: 'Segmento E',
  segmentF: 'Segmento F',
  segmentG: 'Segmento G',
  sensorModel: 'Modelo do sensor',
  shiftValue: 'Valor deslocado',
  signalStrengthPercent: 'Intensidade do sinal',
  spiMode: 'Modo SPI',
  ssid: 'SSID',
  stallCurrentAmps: 'Corrente de stall',
  strengthPercent: 'Intensidade',
  temperatureC: 'Temperatura',
  temperatureCelsius: 'Temperatura',
  temperatureOffsetC: 'Offset de temperatura',
  thresholdPercent: 'Limite',
  tolerancePercent: 'Tolerância',
  usbPowered: 'Alimentado por USB',
  valueCm: 'Distância',
  voltageVolts: 'Tensão',
  volumePercent: 'Volume',
  wetAnalogValue: 'Valor analógico molhado',
  wifiMode: 'Modo Wi-Fi'
};

const esPropertyMessages = {
  active: 'Activo',
  activeType: 'Tipo activo',
  activeHigh: 'Activo en alto',
  activeLow: 'Activo en bajo',
  address: 'Dirección',
  angleDegrees: 'Ángulo',
  attached: 'Conectado',
  backlight: 'Luz de fondo',
  bluetoothEnabled: 'Bluetooth activado',
  brightResistanceOhms: 'Resistencia con luz fuerte',
  capacitanceMicrofarads: 'Capacitancia',
  capacityLiters: 'Capacidad',
  clearActiveLow: 'Clear activo en bajo',
  clockMHz: 'Clock',
  columns: 'Columnas',
  commonType: 'Tipo común',
  connected: 'Conectado',
  currentAmps: 'Corriente',
  currentLiters: 'Volumen actual',
  darkResistanceOhms: 'Resistencia en oscuridad',
  dryAnalogValue: 'Valor analógico seco',
  enabled: 'Activado',
  flowLitersPerHour: 'Caudal',
  forwardVoltage: 'Tensión directa',
  forwardVoltageVolts: 'Tensión directa',
  frequencyHz: 'Frecuencia',
  gain: 'Ganancia',
  gamma: 'Gamma',
  humidityPercent: 'Humedad',
  i2cAddress: 'Dirección I2C',
  inputLevel: 'Nivel de entrada',
  intensityPercent: 'Intensidad',
  latchedValue: 'Valor retenido',
  line1: 'Línea 1',
  line2: 'Línea 2',
  logicVoltage: 'Tensión lógica',
  maxCm: 'Distancia máxima',
  maxClockHz: 'Clock máximo',
  maxPulseUs: 'Pulso máximo',
  maximumCurrent: 'Corriente máxima',
  maximumPowerWatts: 'Potencia máxima',
  maximumVoltageVolts: 'Tensión máxima',
  minCm: 'Distancia mínima',
  minPulseUs: 'Pulso mínimo',
  minimumVisibleCurrent: 'Corriente mínima visible',
  mode: 'Modo',
  noLoadCurrentAmps: 'Corriente sin carga',
  nominalVoltageVolts: 'Tensión nominal',
  outputEnabled: 'Salida activada',
  overflowActive: 'Overflow activo',
  oversampling: 'Oversampling',
  percent: 'Porcentaje',
  pressureHpa: 'Presión',
  pressureOffsetHpa: 'Offset de presión',
  pressed: 'Presionado',
  ratedCurrentAmps: 'Corriente nominal',
  ratedVoltageVolts: 'Tensión nominal',
  readIntervalMs: 'Intervalo de lectura',
  referenceVoltageVolts: 'Tensión de referencia',
  recommendedCurrent: 'Corriente recomendada',
  recommendedCurrentAmps: 'Corriente recomendada',
  responseMs: 'Tiempo de respuesta',
  resolutionBits: 'Resolución',
  resistanceOhms: 'Resistencia',
  rows: 'Filas',
  sampleRateSps: 'Tasa de muestreo',
  segmentA: 'Segmento A',
  segmentB: 'Segmento B',
  segmentC: 'Segmento C',
  segmentD: 'Segmento D',
  segmentDp: 'Segmento DP',
  segmentE: 'Segmento E',
  segmentF: 'Segmento F',
  segmentG: 'Segmento G',
  sensorModel: 'Modelo del sensor',
  shiftValue: 'Valor desplazado',
  signalStrengthPercent: 'Intensidad de señal',
  spiMode: 'Modo SPI',
  ssid: 'SSID',
  stallCurrentAmps: 'Corriente de stall',
  strengthPercent: 'Intensidad',
  temperatureC: 'Temperatura',
  temperatureCelsius: 'Temperatura',
  temperatureOffsetC: 'Offset de temperatura',
  thresholdPercent: 'Umbral',
  tolerancePercent: 'Tolerancia',
  usbPowered: 'Alimentado por USB',
  valueCm: 'Distancia',
  voltageVolts: 'Tensión',
  volumePercent: 'Volumen',
  wetAnalogValue: 'Valor analógico mojado',
  wifiMode: 'Modo Wi-Fi'
};

const enMessages = {
  'Virtual Embedded Lab': 'Virtual Embedded Lab',
  'Build without components': 'Build without components',
  Language: 'Language',
  Examples: 'Examples',
  Components: 'Components',
  'Loading official components...': 'Loading official components...',
  Save: 'Save',
  Load: 'Load',
  Export: 'Export',
  Import: 'Import',
  Properties: 'Properties',
  'Select a component or wire.': 'Select a component or wire.',
  Signals: 'Signals',
  Code: 'Code',
  Console: 'Console',
  Problems: 'Problems',
  'Runtime ready.': 'Runtime ready.',
  'Active firmware': 'Active firmware',
  'Arduino code editor': 'Arduino code editor',
  'Resize bottom panel': 'Resize bottom panel',
  'Target RX Serial': 'Target RX Serial',
  'Serial baud rate': 'Serial baud rate',
  Send: 'Send',
  'No serial messages.': 'No serial messages.',
  'Load a complete project with board and code.': 'Load a complete project with board and code.',
  Close: 'Close',
  'Loading examples...': 'Loading examples...',
  'Circuit not simulated yet.': 'Circuit not simulated yet.',
  'Enable component audio': 'Enable component audio',
  'No examples found.': 'No examples found.',
  'Select a component to view derived connection signals.': 'Select a component to view derived connection signals.',
  'This component does not have derived project signals yet.': 'This component does not have derived project signals yet.',
  'Terminals and connections': 'Terminals and connections',
  Electrical: 'Electrical',
  Voltage: 'Voltage',
  Current: 'Current',
  Power: 'Power'
  ,
  'Loading example...': 'Loading example...',
  'Failed to load official components': 'Failed to load official components',
  'Failed to load examples': 'Failed to load examples',
  'Failed to load default example': 'Failed to load default example',
  'No project loaded.': 'No project loaded.',
  'Project saved in browser': 'Project saved in browser',
  components: 'components',
  'electrical connections': 'electrical connections',
  'environment connections': 'environment connections',
  'No project saved in browser.': 'No project saved in browser.',
  'Failed to load saved project': 'Failed to load saved project',
  'Project exported as JSON.': 'Project exported as JSON.',
  'Failed to import project': 'Failed to import project',
  'Project loaded': 'Project loaded',
  'Simulation blocked: Clang found a firmware error.': 'Simulation blocked: Clang found a firmware error.',
  'Simulation blocked: WASM firmware was not compiled.': 'Simulation blocked: WASM firmware was not compiled.',
  'No critical problems reported by the kernel.': 'No critical problems reported by the kernel.',
  'Simulation failed': 'Simulation failed',
  'Simulation paused.': 'Simulation paused.'
};

const esMessages = {
  'Virtual Embedded Lab': 'Laboratorio Embebido Virtual',
  'Build without components': 'Build without components',
  Language: 'Idioma',
  Examples: 'Ejemplos',
  Components: 'Componentes',
  'Loading official components...': 'Cargando componentes oficiales...',
  Save: 'Guardar',
  Load: 'Cargar',
  Export: 'Exportar',
  Import: 'Importar',
  Properties: 'Propiedades',
  'Select a component or wire.': 'Selecciona un componente o cable.',
  Signals: 'Señales',
  Code: 'Código',
  Console: 'Consola',
  Problems: 'Problemas',
  'Runtime ready.': 'Runtime listo.',
  'Active firmware': 'Firmware activo',
  'Arduino code editor': 'Editor de código Arduino',
  'Resize bottom panel': 'Redimensionar panel inferior',
  'Target RX Serial': 'Destino RX Serial',
  'Serial baud rate': 'Tasa de baudios Serial',
  Send: 'Enviar',
  'No serial messages.': 'No hay mensajes seriales.',
  'Load a complete project with board and code.': 'Carga un proyecto completo con placa y código.',
  Close: 'Cerrar',
  'Loading examples...': 'Cargando ejemplos...',
  'Circuit not simulated yet.': 'Circuito aún no simulado.',
  'Enable component audio': 'Activar audio de los componentes',
  'No examples found.': 'No se encontraron ejemplos.',
  'Select a component to view derived connection signals.': 'Selecciona un componente para ver señales derivadas de las conexiones.',
  'This component does not have derived project signals yet.': 'Este componente aún no tiene señales derivadas del proyecto.',
  'Terminals and connections': 'Terminales y conexiones',
  Electrical: 'Eléctrico',
  Voltage: 'Tensión',
  Current: 'Corriente',
  Power: 'Potencia',
  'Loading example...': 'Cargando ejemplo...',
  'Failed to load official components': 'Error al cargar componentes oficiales',
  'Failed to load examples': 'Error al cargar ejemplos',
  'Failed to load default example': 'Error al cargar el ejemplo predeterminado',
  'No project loaded.': 'Ningún proyecto cargado.',
  'Project saved in browser': 'Proyecto guardado en el navegador',
  components: 'componentes',
  'electrical connections': 'conexiones eléctricas',
  'environment connections': 'conexiones ambientales',
  'No project saved in browser.': 'No hay proyecto guardado en el navegador.',
  'Failed to load saved project': 'Error al cargar el proyecto guardado',
  'Project exported as JSON.': 'Proyecto exportado como JSON.',
  'Failed to import project': 'Error al importar proyecto',
  'Project loaded': 'Proyecto cargado',
  'Simulation blocked: Clang found a firmware error.': 'Simulación bloqueada: Clang encontró un error en el firmware.',
  'Simulation blocked: WASM firmware was not compiled.': 'Simulación bloqueada: el firmware WASM no fue compilado.',
  'No critical problems reported by the kernel.': 'El kernel no reportó problemas críticos.',
  'Simulation failed': 'Error de simulación',
  'Simulation paused.': 'Simulación pausada.',
  'Audio Off': 'Audio apagado',
  'Audio On': 'Audio encendido',
  Run: 'Ejecutar',
  Pause: 'Pausar',
  Reset: 'Reiniciar',
  Undo: 'Deshacer',
  Redo: 'Rehacer',
  Clear: 'Limpiar',
  'Board visual': 'Placa visual',
  'Drag components here': 'Arrastra componentes aquí',
  'Auto-scroll Serial': 'Desplazamiento automático Serial',
  'Auto-scroll Serial enabled': 'Desplazamiento automático Serial activado',
  'Auto-scroll Serial disabled': 'Desplazamiento automático Serial desactivado',
  Press: 'Presionar',
  ON: 'Encendido',
  OFF: 'Apagado',
  HIGH: 'Alto',
  LOW: 'Bajo',
  WET: 'Mojado',
  DRY: 'Seco',
  DARK: 'Oscuro',
  DIM: 'Media luz',
  BRIGHT: 'Claro',
  raw: 'bruto',
  '-- raw': '-- bruto',
  serial: 'serial',
  'no baud': 'sin baudios',
  Boards: 'Placas',
  Electronic: 'Electrónica',
  Electronics: 'Electrónica',
  Inputs: 'Entradas',
  Outputs: 'Salidas',
  Displays: 'Displays',
  'LED Displays': 'Displays LED',
  ICs: 'CIs',
  Sensors: 'Sensores',
  Actuators: 'Actuadores',
  Environment: 'Ambiente',
  'Shift Registers': 'Registros de desplazamiento',
  ADCs: 'ADCs',
  Control: 'Control',
  Power: 'Energía',
  Passive: 'Pasivos',
  Wireless: 'Inalámbrico',
  Climate: 'Clima',
  Water: 'Agua',
  Buttons: 'Botones',
  Capacitors: 'Capacitores',
  LEDs: 'LEDs',
  Modules: 'Módulos',
  Motors: 'Motores',
  Relays: 'Relés',
  Resistors: 'Resistores',
  Weather: 'Clima',
  '7 Segment': 'Display LED de 7 segmentos',
  '7-Segment LED Display': 'Display LED de 7 segmentos',
  '74HC595 Shift Register': 'Registro de desplazamiento 74HC595',
  'Pull-up Button': 'Botón pull-up',
  Button: 'Botón',
  'Push Button': 'Botón',
  'Momentary Button': 'Botón momentáneo',
  'Blue LED': 'LED azul',
  'Red LED': 'LED rojo',
  'Green LED': 'LED verde',
  'Yellow LED': 'LED amarillo',
  'Servo Motor': 'Servo motor',
  'HC-SR04 Ultrasonic Sensor': 'Sensor ultrasónico HC-SR04',
  'DHT11 Sensor': 'Sensor DHT11',
  'DHT22 Sensor': 'Sensor DHT22',
  'BMP280 Sensor': 'Sensor BMP280',
  'FC-37 Rain Sensor': 'Sensor de lluvia FC-37',
  'LDR Light Sensor': 'Sensor de luz LDR',
  'Wi-Fi Signal': 'Señal Wi-Fi',
  'Light Level': 'Nivel de luz',
  'Rain Toggle': 'Control de lluvia',
  'Distance Range': 'Rango de distancia',
  'Climate Source': 'Fuente de clima',
  'Water Reservoir': 'Reservorio de agua',
  'Water Pump': 'Bomba de agua',
  'Solid State Relay': 'Relé de estado sólido',
  '1-Channel Solid State Relay': 'Relé de estado sólido de 1 canal',
  'Analog Voltage Source': 'Fuente de tensión analógica',
  'MCP3008 ADC': 'ADC MCP3008',
  'ADS1015 ADC': 'ADC ADS1015',
  'ADS1115 ADC': 'ADC ADS1115',
  'Common cathode': 'Cátodo común',
  'Common anode': 'Ánodo común',
  Catodo: 'Cátodo',
  Anodo: 'Ánodo',
  Cathode: 'Cátodo',
  Anode: 'Ánodo',
  '3.3V logic / Wi-Fi': 'Lógica 3,3 V / Wi-Fi',
  '3.3V logic / Wi-Fi / Bluetooth': 'Lógica 3,3 V / Wi-Fi / Bluetooth',
  '5V logic / GPIO': 'Lógica 5 V / GPIO',
  '10-bit SPI ADC': 'ADC SPI de 10 bits',
  '12-bit ADC': 'ADC de 12 bits',
  '16-bit ADC': 'ADC de 16 bits',
  '16x2 I2C display': 'Display I2C 16x2',
  '5V logic': 'Lógica 5 V',
  '3.3V logic': 'Lógica 3,3 V',
  'Active HIGH': 'Activo en HIGH',
  'Active Type': 'Tipo activo',
  Analog: 'Analógico',
  Addr: 'Dirección',
  Attached: 'Conectado',
  Backlight: 'Luz de fondo',
  'Bluetooth Enabled': 'Bluetooth activado',
  'BMP280 Pressure/Temperature': 'BMP280 presión/temperatura',
  Connected: 'Conectado',
  'Character LCD': 'LCD de caracteres',
  Cap: 'Cap.',
  'FC-37 Rain': 'Lluvia FC-37',
  Flow: 'Caudal',
  Freq: 'Frec.',
  'High sensitivity': 'Alta sensibilidad',
  'LDR Light': 'Luz LDR',
  Light: 'Luz',
  'Light Environment': 'Ambiente de luz',
  'Low sensitivity': 'Baja sensibilidad',
  Mode: 'Modo',
  Pump: 'Bomba',
  Rain: 'Lluvia',
  Servo: 'Servo',
  Sound: 'Sonido',
  'Standard 5 mm': 'Estándar 5 mm',
  Tank: 'Tanque',
  'Water Tank': 'Tanque de agua',
  off: 'apagado'
};

const localeMessages = {
  'pt-BR': ptBRMessages,
  en: enMessages,
  es: esMessages
};

let currentLocale = readStoredLocale();

export function t(key) {
  if (key === undefined || key === null) {
    return key;
  }

  const value = String(key);
  return localeMessages[currentLocale]?.[value] ?? value;
}

export function stateText(key) {
  return t(key);
}

export function propertyLabel(key) {
  if (currentLocale === 'pt-BR') {
    return propertyMessages[key] ?? labelFromCamelCase(key);
  }

  if (currentLocale === 'es') {
    return esPropertyMessages[key] ?? labelFromCamelCase(key);
  }

  return labelFromCamelCase(key);
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  currentLocale = normalizeLocale(locale);
  safeLocalStorage()?.setItem(localeStorageKey, currentLocale);
}

export function applyDocumentTranslations(root) {
  root.documentElement.lang = currentLocale;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  });
}

export function bindLanguageSelector(document) {
  const selector = document.querySelector('#languageSelector');

  if (!selector) {
    return;
  }

  selector.value = currentLocale;
  selector.addEventListener('change', () => {
    setLocale(selector.value);
    document.location.reload();
  });
}

export function localizeComponentDefinition(definition) {
  return {
    ...definition,
    title: t(definition.title),
    body: t(definition.body),
    controls: localizeControls(definition.controls),
    propertySchema: localizePropertySchema(definition.propertySchema),
    variants: localizeVariants(definition.variants),
    palette: definition.palette ? localizePalette(definition.palette) : null,
    stateBindings: localizeStateBindings(definition.stateBindings),
    terminals: definition.terminals.map((terminal) => ({
      ...terminal,
      label: t(terminal.label)
    }))
  };
}

function localizeControls(controls = []) {
  return controls.map((control) => ({
    ...control,
    label: t(control.label),
    text: t(control.text),
    inactiveText: t(control.inactiveText),
    children: localizeControls(control.children ?? [])
  }));
}

function localizePropertySchema(schema = {}) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, property]) => [
      key,
      {
        ...property,
        label: t(property.label ?? propertyLabel(key))
      }
    ])
  );
}

function localizeVariants(variants = {}) {
  return Object.fromEntries(
    Object.entries(variants).map(([key, values]) => [
      key,
      values.map((variant) => ({
        ...variant,
        label: t(variant.label)
      }))
    ])
  );
}

function localizePalette(palette) {
  const localized = { ...palette };

  if (palette.group !== undefined) {
    localized.group = t(palette.group);
  }

  if (palette.subgroup !== undefined) {
    localized.subgroup = t(palette.subgroup);
  }

  if (palette.title !== undefined) {
    localized.title = t(palette.title);
  }

  return localized;
}

function localizeStateBindings(bindings = []) {
  return bindings.map((binding) => ({
    ...binding,
    text: t(binding.text),
    disabledText: t(binding.disabledText)
  }));
}

function labelFromCamelCase(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

function readStoredLocale() {
  return normalizeLocale(safeLocalStorage()?.getItem(localeStorageKey));
}

function normalizeLocale(locale) {
  return supportedLocales.includes(locale) ? locale : defaultLocale;
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

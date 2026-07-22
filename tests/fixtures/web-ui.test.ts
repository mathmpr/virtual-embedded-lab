import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { componentDefinitionFromManifest } from '../../apps/web/js/components.js';
import { renderComponentTemplate } from '../../apps/web/js/board/component-template.js';
import { getLocale, setLocale, supportedLocales, t } from '../../apps/web/js/i18n.js';

const root = new URL('../..', import.meta.url).pathname;

test('web UI entrypoint contains required workspace regions', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8');

  assert.match(html, /id="board"/);
  assert.match(html, /id="boardViewport"/);
  assert.match(html, /id="componentLayer"/);
  assert.match(html, /id="codeEditor"/);
  assert.match(html, /@codemirror\/state/);
  assert.match(html, /@marijn\/find-cluster-break/);
  assert.match(html, /id="bottomResizeHandle"/);
  assert.match(html, /data-bottom-tab="code"/);
  assert.match(html, /data-bottom-tab="console"/);
  assert.match(html, /data-bottom-tab="serial"/);
  assert.match(html, /data-bottom-tab="problems"/);
  assert.match(html, /id="signalMonitor"/);
  assert.match(html, /class="inspector-signals"/);
  assert.doesNotMatch(html, /<button>Sinais<\/button>/);
  assert.doesNotMatch(html, /<strong>Monitor de sinais<\/strong>/);
  assert.match(html, /id="serialMonitor"/);
  assert.match(html, /id="toggleSerialAutoScroll"/);
  assert.match(html, /class="serial-actions"/);
  assert.match(html, /⇣ Auto/);
  assert.match(html, /id="serialBaudRate"/);
  assert.match(html, /value="9600"/);
  assert.match(html, /value="115200" selected/);
  assert.match(html, /value="250000"/);
  assert.match(html, /id="serialInput"/);
  assert.match(html, /id="sendSerialInput"/);
  assert.match(html, /id="clearSerialHistory"/);
  assert.match(html, /id="startSimulation"/);
  assert.match(html, /id="openExamples"/);
  assert.match(html, /id="examplesDialog"/);
  assert.match(html, /id="examplesList"/);
  assert.match(html, /id="undoBoard"/);
  assert.match(html, /id="redoBoard"/);
  assert.match(html, /id="saveProject"/);
  assert.match(html, /id="loadSavedProject"/);
  assert.match(html, /id="exportProject"/);
  assert.match(html, /id="importProject"/);
  assert.match(html, /id="projectFileInput"/);
  assert.doesNotMatch(html, /id="loadExample"/);
  assert.doesNotMatch(html, />Projeto<\/button>/);
  assert.doesNotMatch(html, />Componentes<\/button>/);
  assert.doesNotMatch(html, />Simulação<\/button>/);
  assert.doesNotMatch(html, />Visualização<\/button>/);
});

test('web UI script defines the MVP components', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8');
  const script = readFileSync(join(root, 'apps/web/js/components.js'), 'utf8');
  const boardEditor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');
  const buzzerStyles = readFileSync(join(root, 'components/official/buzzer/ui/styles.css'), 'utf8');
  const lcdStyles = readFileSync(join(root, 'components/official/lcd-16x2-i2c/ui/styles.css'), 'utf8');
  const sevenSegmentStyles = readFileSync(join(root, 'components/official/seven-segment-display/ui/styles.css'), 'utf8');
  const dhtStyles = readFileSync(join(root, 'components/official/dht22/ui/styles.css'), 'utf8');
  const servoStyles = readFileSync(join(root, 'components/official/servo-motor/ui/styles.css'), 'utf8');
  const wifiStyles = readFileSync(join(root, 'components/official/wifi-signal/ui/styles.css'), 'utf8');
  const bmp280Styles = readFileSync(join(root, 'components/official/bmp280/ui/styles.css'), 'utf8');
  const adcStyles = readFileSync(join(root, 'components/official/ads1015/ui/styles.css'), 'utf8');

  for (const manifest of [
    'components/official/ads1015/component.json',
    'components/official/ads1115/component.json',
    'components/official/74hc595/component.json',
    'components/official/analog-voltage-source/component.json',
    'components/official/arduino-nano/component.json',
    'components/official/arduino-uno/component.json',
    'components/official/bmp280/component.json',
    'components/official/buzzer/component.json',
    'components/official/esp32-devkit/component.json',
    'components/official/esp8266-nodemcu/component.json',
    'components/official/hc-sr04/component.json',
    'components/official/fc-37-rain-sensor/component.json',
    'components/official/ldr-light-sensor/component.json',
    'components/official/resistor/component.json',
    'components/official/capacitor/component.json',
    'components/official/led-red/component.json',
    'components/official/led-green/component.json',
    'components/official/led-blue/component.json',
    'components/official/led-yellow/component.json',
    'components/official/lcd-16x2-i2c/component.json',
    'components/official/climate/component.json',
    'components/official/distance-range/component.json',
    'components/official/dht11/component.json',
    'components/official/dht22/component.json',
    'components/official/light-level/component.json',
    'components/official/mcp3008/component.json',
    'components/official/rain-toggle/component.json',
    'components/official/seven-segment-display/component.json',
    'components/official/servo-motor/component.json',
    'components/official/wifi-signal/component.json'
  ]) {
    const component = JSON.parse(readFileSync(join(root, manifest), 'utf8'));

    assert.ok(component.visual.type);
    assert.ok(component.visual.palette.group);
  }

  assert.match(html, /Carregando componentes oficiais/);
  assert.match(html, /toggleAudio/);
  assert.match(script, /loadOfficialComponents/);
  assert.match(boardEditor, /createBuzzerAudioController/);
  assert.match(boardEditor, /onSimulationStopped/);
  assert.match(boardEditor, /syncRuntimeUpdatedComponentControls/);
  assert.match(script, /componentDefinitionFromManifest/);
  assert.match(script, /behavior: manifest\.behavior/);
  assert.doesNotMatch(script, /const int TRIGGER_PIN/);
  assert.match(boardEditor, /renderPalette\(\)/);
  assert.match(boardEditor, /data-component="\$\{item\.type\}"/);
  assert.match(css, /\.palette-scroll/);
  assert.match(css, /overflow-y: auto;/);
  assert.match(css, /\.palette-group-title/);
  assert.match(css, /\.palette-subgroup-title/);
  assert.match(css, /\.capacitor-icon/);
  assert.match(css, /\.capacitor/);
  assert.match(css, /\.led-green-icon/);
  assert.match(css, /\.led-blue-icon/);
  assert.match(css, /\.led-yellow-icon/);
  assert.match(css, /\.led-green \.led-glow/);
  assert.match(css, /\.led-blue \.led-glow/);
  assert.match(css, /\.led-yellow \.led-glow/);
  assert.match(css, /\.led-yellow\.on/);
  assert.match(buzzerStyles, /\.buzzer-icon/);
  assert.match(lcdStyles, /\.lcd-icon/);
  assert.match(sevenSegmentStyles, /\.seven-segment-icon/);
  assert.match(css, /\.shift-register-icon/);
  assert.match(dhtStyles, /\.dht-icon/);
  assert.match(css, /\.arduino-nano-icon/);
  assert.match(servoStyles, /\.servo-icon/);
  assert.match(wifiStyles, /\.wifi-icon/);
  assert.match(wifiStyles, /\.wifi-signal/);
  assert.match(css, /\.rain-icon/);
  assert.match(css, /\.rain-toggle/);
  assert.match(css, /\.rain-sensor-icon/);
  assert.match(css, /\.fc37-rain-sensor/);
  assert.match(css, /\.light-icon/);
  assert.match(css, /\.light-level/);
  assert.match(css, /\.ldr-icon/);
  assert.match(css, /\.ldr-light-sensor/);
  assert.match(bmp280Styles, /\.bmp280-icon/);
  assert.match(bmp280Styles, /\.bmp280-sensor/);
  assert.match(css, /\.climate-icon/);
  assert.match(css, /\.climate-environment/);
  assert.match(css, /\.analog-source-icon/);
  assert.match(css, /\.analog-voltage-source/);
  assert.match(adcStyles, /\.ads1015-icon/);
  assert.match(adcStyles, /\.ads1115-icon/);
  assert.match(css, /\.mcp3008-icon/);
  assert.match(adcStyles, /\.adc-module/);
  assert.match(lcdStyles, /\.lcd-16x2-i2c/);
  assert.match(sevenSegmentStyles, /\.seven-segment-display/);
  assert.match(sevenSegmentStyles, /\.segment\.is-on/);
  assert.match(css, /\.shift-register-74hc595/);
  assert.match(dhtStyles, /\.dht-sensor/);
  assert.match(css, /\.arduino-nano/);
  assert.match(servoStyles, /\.servo-motor/);
  assert.match(servoStyles, /--servo-angle/);
  assert.match(css, /\.esp32-icon/);
  assert.match(css, /\.esp32-devkit/);
  assert.match(css, /\.built-in-led/);
  assert.match(css, /\.examples-dialog/);
  assert.match(css, /\.example-card/);
});

test('web UI defaults visible product text to Portuguese', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(root, 'components/official/seven-segment-display/component.json'), 'utf8'));
  const definition = componentDefinitionFromManifest(manifest);
  const componentHtml = renderComponentTemplate(definition, 'display-1', (_type, propertyName) => definition.variants?.[propertyName] ?? []);

  assert.match(html, /Laboratório Embarcado Virtual/);
  assert.match(html, /Build without components/);
  assert.match(html, />Executar<\/button>/);
  assert.match(html, />Pausar<\/button>/);
  assert.match(html, />Reiniciar<\/button>/);
  assert.match(html, />Desfazer<\/button>/);
  assert.match(html, />Refazer<\/button>/);
  assert.match(html, /Arraste componentes aqui/);
  assert.doesNotMatch(html, />Run<\/button>|>Pause<\/button>|>Reset<\/button>|>Undo<\/button>|>Redo<\/button>|>Drag components here<\/div>/);
  assert.equal(definition.title, 'Display LED de 7 segmentos');
  assert.equal(definition.palette?.group, 'Displays');
  assert.equal(definition.palette?.subgroup, 'Displays LED');
  assert.match(componentHtml, /Cátodo comum/);
  assert.doesNotMatch(componentHtml, /Common cathode/);
});

test('web UI exposes a persisted language selector with Portuguese, English and Spanish', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8');
  const boardEditor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const i18n = readFileSync(join(root, 'apps/web/js/i18n.js'), 'utf8');
  const initialLocale = getLocale();

  assert.match(html, /id="languageSelector"/);
  assert.match(html, /value="pt-BR"/);
  assert.match(html, /value="en"/);
  assert.match(html, /value="es"/);
  assert.match(boardEditor, /bindLanguageSelector\(document, syncLocalizedUi\)/);
  assert.match(boardEditor, /relocalizeComponentCatalog\(\)/);
  assert.match(boardEditor, /rerenderBoardComponents\(\)/);
  assert.doesNotMatch(i18n, /location\.reload/);
  assert.doesNotThrow(() => readFileSync(join(root, 'apps/web/js/i18n/locales/pt-BR.js'), 'utf8'));
  assert.doesNotThrow(() => readFileSync(join(root, 'apps/web/js/i18n/locales/en.js'), 'utf8'));
  assert.doesNotThrow(() => readFileSync(join(root, 'apps/web/js/i18n/locales/es.js'), 'utf8'));
  assert.deepEqual(supportedLocales, ['pt-BR', 'en', 'es']);

  setLocale('pt-BR');
  assert.equal(t('Run'), 'Executar');
  assert.equal(t('Virtual Embedded Lab'), 'Laboratório Embarcado Virtual');

  setLocale('en');
  assert.equal(t('Run'), 'Run');
  assert.equal(t('Virtual Embedded Lab'), 'Virtual Embedded Lab');

  setLocale('es');
  assert.equal(t('Run'), 'Ejecutar');
  assert.equal(t('Virtual Embedded Lab'), 'Laboratorio Embebido Virtual');

  setLocale(initialLocale);
});

test('web server exposes official component and example catalog APIs', () => {
  const server = readFileSync(join(root, 'apps/web/server.mjs'), 'utf8');

  assert.match(server, /url\.pathname === '\/api\/components'/);
  assert.match(server, /url\.pathname === '\/api\/firmware\/compile-wasm'/);
  assert.match(server, /url\.pathname === '\/api\/examples'/);
  assert.match(server, /url\.pathname\.startsWith\('\/api\/examples\/'\)/);
  assert.match(server, /components', 'official'/);
  assert.match(server, /examples', exampleId, 'project\.json'/);
  assert.match(server, /readOfficialComponentManifests/);
  assert.match(server, /readExampleProject/);
  assert.match(server, /entry\.name === 'component\.json'/);
  assert.match(server, /compileFirmwareWasmWithClang/);
});

test('web UI prevents known interaction regressions', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentBinder = readFileSync(join(root, 'apps/web/js/board/component-binder.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const solver = readFileSync(join(root, 'apps/web/js/simulation/electrical-solver.js'), 'utf8');

  assert.match(script, /nextComponentId\(type\)/);
  assert.match(script, /syncComponentCounter\(componentId\)/);
  assert.match(solver, /solveElectricalState\(\{ graph, runtime, runtimesByComponent = null \}\)/);
  assert.match(solver, /findDrivenHighPins\(\{ graph, runtime, arduino, runtimesByComponent \}\)/);
  assert.match(componentBinder, /closest\('/);
  assert.match(componentBinder, /input, textarea, select/);
  assert.match(componentTemplate, /data-delete-component/);
  assert.match(componentBinder, /input\.addEventListener\('pointerdown'/);
});

test('web UI exposes editable distance, resistor and capacitor properties', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const components = readFileSync(join(root, 'apps/web/js/components.js'), 'utf8');
  const resistor = readFileSync(join(root, 'components/official/resistor/component.json'), 'utf8');
  const capacitor = readFileSync(join(root, 'components/official/capacitor/component.json'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(components, /variants:/);
  assert.match(resistor, /1 kΩ/);
  assert.match(capacitor, /capacitanceMicrofarads/);
  assert.match(capacitor, /4700 µF/);
  assert.match(componentTemplate, /renderVisualControl/);
  assert.match(componentTemplate, /renderDataAttribute/);
  assert.match(componentTemplate, /case 'boolean'/);
  assert.match(componentTemplate, /case 'number'/);
  assert.match(componentTemplate, /case 'string'/);
  assert.match(componentTemplate, /case 'variant'/);
  assert.doesNotMatch(componentTemplate, /definition\.className/);
  assert.match(componentTemplate, /data-property=/);
  assert.doesNotMatch(resistor, /data-resistor-select/);
  assert.doesNotMatch(capacitor, /data-capacitor-select/);
  assert.match(inspector, /propertySchema/);
  assert.match(inspector, /data-property/);
  assert.match(inspector, /renderInspectorPropertyControl/);
  assert.match(inspector, /updateComponentProperty/);
  assert.doesNotMatch(inspector, /data-inspector-resistor/);
  assert.doesNotMatch(inspector, /data-inspector-capacitor/);
  assert.doesNotMatch(inspector, /data-inspector-distance/);
  assert.match(componentState, /function updateComponentProperty\(component, propertyName, value/);
  assert.match(componentState, /function bindingTargets\(component, binding\)/);
  assert.doesNotMatch(componentState, /function updateResistorValue/);
  assert.doesNotMatch(componentState, /function updateCapacitorValue/);
  assert.match(css, /\.component-select-row/);
  assert.match(css, /\.editable-property/);
});

test('component template renders state binding data attributes as real DOM attributes', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'components/official/seven-segment-display/component.json'), 'utf8'));
  const definition = componentDefinitionFromManifest(manifest);
  const html = renderComponentTemplate(definition, 'display-1', (_type, propertyName) => definition.variants?.[propertyName] ?? []);

  assert.match(html, /data-segment="a"/);
  assert.doesNotMatch(html, /data-segment=&quot;a&quot;/);
});

test('component template renders LCD line binding attributes as real DOM attributes', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'components/official/lcd-16x2-i2c/component.json'), 'utf8'));
  const definition = componentDefinitionFromManifest(manifest);
  const html = renderComponentTemplate(definition, 'lcd-1', (_type, propertyName) => definition.variants?.[propertyName] ?? []);

  assert.match(html, /data-lcd-line="1"/);
  assert.doesNotMatch(html, /data-lcd-line=&quot;1&quot;/);
});

test('web UI renders editable properties from component schemas', () => {
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const editableProperties = inspector.match(/function renderEditableProperties\(component\) \{[\s\S]*?\n  \}\n\n  function bindInspectorPropertyControls/)?.[0] ?? '';

  assert.match(editableProperties, /propertySchema/);
  assert.match(editableProperties, /renderInspectorPropertyControl/);
  assert.doesNotMatch(editableProperties, /if\s*\([^)]*component\.type/);
  assert.doesNotMatch(editableProperties, /data-inspector-[a-z-]+/);
});

test('web UI exposes editable Wi-Fi signal controls', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const wifiSignal = readFileSync(join(root, 'components/official/wifi-signal/component.json'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const environmentPayload = readFileSync(join(root, 'apps/web/js/simulation/environment-payload.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');
  const firmware = readFileSync(join(root, 'apps/web/js/simulation/firmware-engine.js'), 'utf8');
  const analyzer = readFileSync(join(root, 'apps/web/firmware/clang-analyzer.mjs'), 'utf8');
  const wifiShim = readFileSync(join(root, 'components/official/esp32-devkit/firmware/shims/wifi.cpp'), 'utf8');
  const libraryResolver = readFileSync(join(root, 'apps/web/firmware/library-resolver.mjs'), 'utf8');

  assert.match(componentTemplate, /renderVisualControl/);
  assert.doesNotMatch(wifiSignal, /data-wifi-slider/);
  assert.doesNotMatch(wifiSignal, /data-wifi-connected/);
  assert.match(wifiSignal, /Internet ativa/);
  assert.match(inspector, /data-property/);
  assert.doesNotMatch(inspector, /updateWirelessEnvironmentProperty/);
  assert.match(componentState, /propertySimulationUpdateMode/);
  assert.match(wifiSignal, /"simulationUpdate": "rerun"/);
  assert.doesNotMatch(inspector, /data-inspector-wifi-strength/);
  assert.doesNotMatch(inspector, /data-inspector-wifi-connected/);
  assert.doesNotMatch(componentState, /function updateWifiStrength/);
  assert.doesNotMatch(componentState, /function updateWifiInternetAvailable/);
  assert.match(engine, /bindWifiEnvironment\(/);
  assert.match(engine, /environmentPayloadForComponent\(component\)/);
  assert.match(environmentPayload, /wifiEnvironmentPayload/);
  assert.match(runtime, /configureWifiEnvironment\(environment\)/);
  assert.match(runtime, /wifiBegin\(ssid, password/);
  assert.match(runtime, /wifiSoftAp\(ssid, password/);
  assert.match(runtime, /internetAvailable/);
  assert.doesNotMatch(runtime, /return environment\.connected && environment\.strengthPercent > 0/);
  assert.match(firmware, /WiFi\.begin/);
  assert.match(firmware, /WiFi\.status/);
  assert.match(firmware, /WiFi\.softAP/);
  assert.match(firmware, /WiFi\.scanNetworks/);
  assert.match(firmware, /WiFi\.RSSI/);
  assert.doesNotMatch(analyzer, /class WiFiClass/);
  assert.match(wifiShim, /class WiFiClass/);
  assert.match(analyzer, /stripResolvedFirmwareIncludes/);
  assert.match(libraryResolver, /resolveFirmwareLibraryBundle/);
});

test('web UI exposes FC-37 rain controls and runtime bindings', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const rainToggle = readFileSync(join(root, 'components/official/rain-toggle/component.json'), 'utf8');
  const rainSensor = readFileSync(join(root, 'components/official/fc-37-rain-sensor/component.json'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const signals = readFileSync(join(root, 'apps/web/js/board/signals-panel.js'), 'utf8');
  const pinResolver = readFileSync(join(root, 'apps/web/js/board/pin-resolver.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const behaviorRegistry = readFileSync(join(root, 'apps/web/js/simulation/behavior-registry.js'), 'utf8');
  const sensorAdapters = readFileSync(join(root, 'apps/web/js/simulation/sensor-behavior-adapters.js'), 'utf8');
  const simulationPinResolver = readFileSync(join(root, 'apps/web/js/simulation/pin-capability-resolver.js'), 'utf8');
  const environmentPayload = readFileSync(join(root, 'apps/web/js/simulation/environment-payload.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');

  assert.match(componentTemplate, /renderVisualControl/);
  assert.doesNotMatch(rainToggle, /data-rain-active/);
  assert.doesNotMatch(rainToggle, /data-rain-intensity/);
  assert.match(rainToggle, /"simulationUpdate": "live"/);
  assert.match(rainSensor, /data-rain-sensor-state/);
  assert.match(rainSensor, /stateBindings/);
  assert.match(componentState, /applyVisualStateBindings/);
  assert.doesNotMatch(componentState, /function applyRainSensorStates/);
  assert.match(inspector, /data-property/);
  assert.doesNotMatch(inspector, /data-inspector-rain-active/);
  assert.doesNotMatch(inspector, /data-inspector-rain-sensor-active-low/);
  assert.doesNotMatch(componentState, /function updateRainActive/);
  assert.doesNotMatch(componentState, /function updateRainSensorActiveLow/);
  assert.match(signals, /terminalSignalCard\(component\)/);
  assert.match(signals, /runtimeSignalForNet\(net\)/);
  assert.match(engine, /createSimulationBehaviorRegistry/);
  assert.match(behaviorRegistry, /bindAll\(context\)/);
  assert.match(sensorAdapters, /registry\.register\('rain-sensor'/);
  assert.match(sensorAdapters, /resolveDigitalPinConnectedToTerminal/);
  assert.match(simulationPinResolver, /capability: 'digital'/);
  assert.match(sensorAdapters, /runtime\.driveInput\(binding\.pin, value\)/);
  assert.match(environmentPayload, /normalizeEnvironmentValue\(channel, value\)/);
  assert.match(componentState, /environmentPayloadForComponent\(component\)/);
  assert.match(adapter, /updateRainValue\(componentId, value\)/);
});

test('web UI exposes LDR light controls and analog runtime bindings', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const lightLevel = readFileSync(join(root, 'components/official/light-level/component.json'), 'utf8');
  const ldrSensor = readFileSync(join(root, 'components/official/ldr-light-sensor/component.json'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const signals = readFileSync(join(root, 'apps/web/js/board/signals-panel.js'), 'utf8');
  const pinResolver = readFileSync(join(root, 'apps/web/js/board/pin-resolver.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const sensorAdapters = readFileSync(join(root, 'apps/web/js/simulation/sensor-behavior-adapters.js'), 'utf8');
  const simulationPinResolver = readFileSync(join(root, 'apps/web/js/simulation/pin-capability-resolver.js'), 'utf8');
  const environmentPayload = readFileSync(join(root, 'apps/web/js/simulation/environment-payload.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const wasmCompiler = readFileSync(join(root, 'apps/web/firmware/wasm-compiler.mjs'), 'utf8');
  const coreConstantsShim = readFileSync(join(root, 'apps/web/firmware/shims/arduino-wasm/20-arduino-core/00-constants.cpp'), 'utf8');
  const coreApiShim = readFileSync(join(root, 'apps/web/firmware/shims/arduino-wasm/20-arduino-core/10-api.cpp'), 'utf8');

  assert.match(componentTemplate, /renderVisualControl/);
  assert.doesNotMatch(lightLevel, /data-light-enabled/);
  assert.doesNotMatch(lightLevel, /data-light-intensity/);
  assert.match(lightLevel, /"simulationUpdate": "live"/);
  assert.match(ldrSensor, /data-ldr-state/);
  assert.match(ldrSensor, /stateBindings/);
  assert.doesNotMatch(componentState, /function applyLdrSensorStates/);
  assert.match(inspector, /data-property/);
  assert.doesNotMatch(inspector, /data-inspector-light-enabled/);
  assert.doesNotMatch(inspector, /data-inspector-ldr-dark/);
  assert.doesNotMatch(componentState, /function updateLightIntensity/);
  assert.doesNotMatch(componentState, /function updateLdrProperty/);
  assert.match(signals, /terminalSignalCard\(component\)/);
  assert.doesNotMatch(signals, /analogPinFromTerminal/);
  assert.match(signals, /runtimePinSignal/);
  assert.match(pinResolver, /runtime\.analogPinStates/);
  assert.match(engine, /registerSensorBehaviorAdapters/);
  assert.match(sensorAdapters, /registry\.register\('light-sensor'/);
  assert.match(sensorAdapters, /resolveAnalogPinConnectedToTerminal/);
  assert.match(simulationPinResolver, /capability: 'analog'/);
  assert.match(sensorAdapters, /runtime\.driveAnalogInput/);
  assert.match(environmentPayload, /channel === 'light'/);
  assert.match(runtime, /analogRead\(pin\)/);
  assert.match(adapter, /updateLightValue\(componentId, value\)/);
  assert.match(coreConstantsShim, /const int A0 = 14/);
  assert.match(coreApiShim, /int analogRead\(int pin\)/);
  assert.doesNotMatch(wasmCompiler, /const int A0 = 14/);
});

test('web UI exposes BMP280 climate controls and I2C runtime bindings', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const climate = readFileSync(join(root, 'components/official/climate/component.json'), 'utf8');
  const bmp280 = readFileSync(join(root, 'components/official/bmp280/component.json'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const sensorAdapters = readFileSync(join(root, 'apps/web/js/simulation/sensor-behavior-adapters.js'), 'utf8');
  const environmentPayload = readFileSync(join(root, 'apps/web/js/simulation/environment-payload.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const wasmCompiler = readFileSync(join(root, 'apps/web/firmware/wasm-compiler.mjs'), 'utf8');
  const wireShim = readFileSync(join(root, 'apps/web/firmware/shims/arduino-wasm/30-buses/wire.cpp'), 'utf8');
  const bmp280Shim = readFileSync(join(root, 'components/official/bmp280/firmware/shims/bmp280.cpp'), 'utf8');

  assert.match(componentTemplate, /renderVisualControl/);
  assert.doesNotMatch(climate, /data-climate-enabled/);
  assert.doesNotMatch(climate, /data-climate-temperature/);
  assert.doesNotMatch(climate, /data-climate-pressure/);
  assert.match(climate, /"simulationUpdate": "live"/);
  assert.match(bmp280, /data-bmp280-state/);
  assert.match(bmp280, /stateBindings/);
  assert.doesNotMatch(componentState, /function applyBmp280SensorStates/);
  assert.match(inspector, /data-property/);
  assert.doesNotMatch(inspector, /data-inspector-bmp280-address/);
  assert.doesNotMatch(componentState, /function updateClimateTemperature/);
  assert.doesNotMatch(componentState, /function updateBmp280Property/);
  assert.match(engine, /registerSensorBehaviorAdapters/);
  assert.match(sensorAdapters, /registry\.register\('bmp280-sensor'/);
  assert.match(sensorAdapters, /runtime\.registerI2cDevice/);
  assert.match(environmentPayload, /channel === 'climate'/);
  assert.match(runtime, /wireBegin\(\)/);
  assert.match(runtime, /bmp280ReadTemperature\(address\)/);
  assert.match(adapter, /updateClimateValue\(componentId, value\)/);
  assert.match(wireShim, /class TwoWire/);
  assert.match(bmp280Shim, /class BMP280/);
  assert.doesNotMatch(wasmCompiler, /class TwoWire/);
  assert.doesNotMatch(wasmCompiler, /class BMP280/);
});

test('web UI exposes external ADC controls and runtime bindings', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentTemplate = readFileSync(join(root, 'apps/web/js/board/component-template.js'), 'utf8');
  const analogSource = readFileSync(join(root, 'components/official/analog-voltage-source/component.json'), 'utf8');
  const ads1015 = readFileSync(join(root, 'components/official/ads1015/component.json'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const sensorAdapters = readFileSync(join(root, 'apps/web/js/simulation/sensor-behavior-adapters.js'), 'utf8');
  const environmentPayload = readFileSync(join(root, 'apps/web/js/simulation/environment-payload.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const wasmCompiler = readFileSync(join(root, 'apps/web/firmware/wasm-compiler.mjs'), 'utf8');
  const adsShim = readFileSync(join(root, 'components/official/ads1015/firmware/shims/ads.cpp'), 'utf8');
  const mcp3008Shim = readFileSync(join(root, 'components/official/mcp3008/firmware/shims/mcp3008.cpp'), 'utf8');

  assert.match(componentTemplate, /renderVisualControl/);
  assert.doesNotMatch(analogSource, /data-analog-voltage/);
  assert.match(analogSource, /"simulationUpdate": "live"/);
  assert.match(ads1015, /data-adc-raw/);
  assert.match(ads1015, /stateBindings/);
  assert.doesNotMatch(componentState, /function applyAdcStates/);
  assert.match(inspector, /data-property/);
  assert.doesNotMatch(inspector, /data-inspector-adc-address/);
  assert.doesNotMatch(componentState, /function updateAnalogVoltage/);
  assert.doesNotMatch(componentState, /function updateAdcProperty/);
  assert.match(engine, /registerSensorBehaviorAdapters/);
  assert.match(sensorAdapters, /registry\.register\('adc-i2c'/);
  assert.match(sensorAdapters, /registry\.register\('adc-spi'/);
  assert.match(sensorAdapters, /resolveI2cBusConnected/);
  assert.match(sensorAdapters, /resolveSpiBusConnected/);
  assert.match(sensorAdapters, /runtime\.registerSpiDevice/);
  assert.match(sensorAdapters, /externalAdcRaw/);
  assert.match(environmentPayload, /channel === 'analog-voltage'/);
  assert.match(runtime, /adcReadSingleEnded\(address, channel\)/);
  assert.match(runtime, /mcp3008Read\(chipSelectPin, channel\)/);
  assert.match(adapter, /updateAnalogVoltageValue\(componentId, value\)/);
  assert.match(adsShim, /class ADS1015/);
  assert.match(adsShim, /class ADS1115/);
  assert.match(mcp3008Shim, /class MCP3008/);
  assert.doesNotMatch(wasmCompiler, /class ADS1015/);
  assert.doesNotMatch(wasmCompiler, /class ADS1115/);
  assert.doesNotMatch(wasmCompiler, /class MCP3008/);
});

test('web UI exposes board deletion and history operations', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const projectActions = readFileSync(join(root, 'apps/web/js/board/project-actions.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(script, /createProjectActions/);
  assert.match(projectActions, /deleteComponent\(componentId\)/);
  assert.match(projectActions, /deleteWire\(wireId\)/);
  assert.match(projectActions, /undoBoard\(\)/);
  assert.match(projectActions, /redoBoard\(\)/);
  assert.match(projectActions, /recordHistory\(\)/);
  assert.match(css, /\.delete-component/);
  assert.match(css, /\.delete-wire/);
  assert.match(css, /\.wire-hit/);
});

test('web UI resolves distance controls dynamically and renders round terminals', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const componentState = readFileSync(join(root, 'apps/web/js/board/component-state.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const environment = readFileSync(join(root, 'apps/web/js/simulation/environment-engine.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(engine, /bindEnvironmentChannels\(/);
  assert.match(engine, /updateDistanceValue\(componentId, valueCm\)/);
  assert.match(environment, /write\(id, value\)/);
  assert.match(adapter, /wasmSimulationSession\?\.updateDistanceValue/);
  assert.match(componentState, /simulation\.updateDistanceValue\(component\.id, component\.properties\[definition\.behavior\.valueProperty\]\)/);
  assert.match(componentState, /propertySimulationUpdateMode/);
  const liveRuntimeUpdateBody = componentState.match(/function applyLiveRuntimeUpdate\(component, definition\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.doesNotMatch(liveRuntimeUpdateBody, /simulation\.runSimulation\(\)/);
  assert.doesNotMatch(engine, /state\.components\.get\('distance-1'\)\?\.properties\.valueCm/);
  assert.match(css, /appearance: none;/);
  assert.match(css, /aspect-ratio: 1;/);
  assert.match(css, /padding: 0;/);
});

test('web UI simulation is routed through a generic kernel adapter', () => {
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const sensorAdapters = readFileSync(join(root, 'apps/web/js/simulation/sensor-behavior-adapters.js'), 'utf8');
  const legacyIr = readFileSync(join(root, 'apps/web/js/simulation/legacy-ir-simulation.js'), 'utf8');
  const firmwareIr = readFileSync(join(root, 'apps/web/js/simulation/firmware-engine.js'), 'utf8');
  const wasmCompiler = readFileSync(join(root, 'apps/web/firmware/wasm-compiler.mjs'), 'utf8');
  const wasmShimRegistry = readFileSync(join(root, 'apps/web/firmware/wasm-shim-registry.mjs'), 'utf8');
  const coreLibraries = readFileSync(join(root, 'apps/web/firmware/core-libraries.json'), 'utf8');
  const espWifiLibrary = readFileSync(join(root, 'components/official/esp32-devkit/firmware/library-wifi.json'), 'utf8');
  const espWasmImports = readFileSync(join(root, 'components/official/esp32-devkit/firmware/wasm-imports.js'), 'utf8');
  const wasmRunner = readFileSync(join(root, 'apps/web/js/simulation/wasm-firmware-runner.js'), 'utf8');
  const wasmImportAdapters = readFileSync(join(root, 'apps/web/js/simulation/wasm-import-adapters.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');

  assert.doesNotMatch(adapter, /runProjectSimulation/);
  assert.doesNotMatch(engine, /firmware-engine\.js/);
  assert.doesNotMatch(engine, /compileArduinoFirmware/);
  assert.doesNotMatch(engine, /runArduinoFirmware/);
  assert.match(legacyIr, /Deprecated IR execution adapter/);
  assert.match(legacyIr, /firmware-engine\.js/);
  assert.match(legacyIr, /runLegacyIrProjectSimulation/);
  assert.match(firmwareIr, /legacyIrFirmwareEngine/);
  assert.match(firmwareIr, /allowNewComponentDependencies: false/);
  assert.match(wasmCompiler, /resolveWasmShimLibraries/);
  assert.match(wasmCompiler, /wasmShimImportsForLibraries/);
  assert.match(wasmCompiler, /supportedWasmLibraryDocs/);
  assert.match(wasmShimRegistry, /supportedWasmLibraryDocs/);
  assert.match(wasmShimRegistry, /resolveFirmwareLibraries/);
  assert.doesNotMatch(coreLibraries, /"headers": \["WiFi", "ESP8266WiFi"\]/);
  assert.match(espWifiLibrary, /"headers": \["WiFi", "ESP8266WiFi"\]/);
  assert.match(espWifiLibrary, /"WiFi\.mode"/);
  assert.match(wasmRunner, /createWasmImportRegistry/);
  assert.match(wasmRunner, /registerDefaultWasmImportAdapters/);
  assert.match(wasmRunner, /registerComponentContributions\('wasmImports'/);
  assert.match(espWasmImports, /libraries: \['WiFi'\]/);
  assert.match(espWasmImports, /capabilities: \['wifi'\]/);
  assert.match(wasmImportAdapters, /arduinoCoreImportAdapter/);
  assert.doesNotMatch(adapter, /d13High/);
  assert.doesNotMatch(adapter, /distanceCm\s*</);
  assert.match(engine, /createCircuitGraph/);
  assert.match(engine, /EnvironmentEngine/);
  assert.match(engine, /createSimulationBehaviorRegistry/);
  assert.match(sensorAdapters, /Hcsr04Behavior/);
  assert.doesNotMatch(engine, /findComponentsByType/);
  assert.match(engine, /ArduinoRuntime/);
  assert.match(engine, /applyBoardConstants/);
  assert.match(engine, /firstProgrammableBuiltInLed/);
  assert.match(engine, /LED_BUILTIN: builtInLed\.pin/);
  assert.match(engine, /loopIterations: 1/);
  assert.match(engine, /builtInLedEvents/);
  assert.match(runtime, /digitalWrite\(pin, value\)/);
  assert.match(runtime, /getPinsSnapshot\(\)/);
  assert.match(runtime, /getPinEventsSnapshot\(\)/);
  assert.match(runtime, /serialBegin\(baudRate\)/);
  assert.match(runtime, /serialReceive\(message\)/);
  assert.match(adapter, /appendSerialEvents/);
  assert.match(adapter, /applyBuiltInLedStates/);
  assert.match(adapter, /animateBuiltInLedEvents/);
  assert.match(adapter, /scheduleNextSimulationFrame/);
  assert.match(adapter, /previousFrameTimeUs/);
  assert.match(adapter, /result\.timeUs - previousFrameTimeUs/);
  assert.doesNotMatch(adapter, /result\.timeUs \/ 1000 \* 0\.12/);
  assert.match(adapter, /frameTimeUs \/ 1000/);
  assert.match(adapter, /stopSimulationTimer/);
  assert.match(adapter, /firmwareAnalysisCache/);
  assert.match(adapter, /wasmSimulationSession/);
  assert.match(adapter, /createProjectWasmSimulationSession/);
  assert.match(adapter, /compileFirmwareWasmWithBackend/);
  assert.match(adapter, /firmwareWasm\.ok !== true/);
  assert.match(adapter, /Simulation blocked: WASM firmware was not compiled\./);
  assert.match(adapter, /firmwareConstantsForBoard/);
  assert.match(adapter, /LED_BUILTIN: led\.pin/);
  assert.doesNotMatch(adapter, /shouldUseWasmFirmware/);
  assert.doesNotMatch(adapter, /wasmEligible/);
  assert.match(engine, /programFromWasmConstants/);
  assert.match(engine, /TRIGGER_PIN/);
  assert.match(engine, /ECHO_PIN/);
  assert.doesNotMatch(adapter, /pulseIn\\s\*\\\(/);
  assert.doesNotMatch(adapter, /component\.type === 'hcsr04'/);
  assert.match(adapter, /setTimeout/);
});

test('web UI exposes electrical solver readings to simulation and inspector', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const graph = readFileSync(join(root, 'apps/web/js/simulation/circuit-graph.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const solver = readFileSync(join(root, 'apps/web/js/simulation/electrical-solver.js'), 'utf8');

  assert.match(engine, /solveElectricalState/);
  assert.match(graph, /findComponentsByBehaviorType\(type\)/);
  assert.doesNotMatch(graph, /findComponentsByType\(type\)/);
  assert.match(solver, /solveLedPath/);
  assert.match(solver, /createElectricalNetlist/);
  assert.match(solver, /applyGenericVoltageSources/);
  assert.match(solver, /applyGenericResistors/);
  assert.match(solver, /applyGenericCapacitors/);
  assert.match(solver, /applySensorModuleLimits/);
  assert.match(solver, /diagnoseFloatingInputs/);
  assert.match(solver, /LED ligado a saída HIGH sem resistor em série/);
  assert.match(solver, /curto direto entre 5V e GND/);
  assert.match(solver, /componentId: component\.id/);
  assert.match(solver, /terminalId: outputTerminal/);
  assert.match(editor, /createInspectorPanel/);
  assert.match(inspector, /renderComponentReadings\(component\.id\)/);
  assert.match(inspector, /formatCurrent\(reading\.currentAmps\)/);
  assert.match(inspector, /netReadings/);
});

test('web UI keeps Serial history append-only during runs and RX input', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const serialPanel = readFileSync(join(root, 'apps/web/js/board/serial-panel.js'), 'utf8');
  const state = readFileSync(join(root, 'apps/web/js/board/state.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(state, /serialHistory: \[\]/);
  assert.match(state, /serialAutoScroll: true/);
  assert.match(editor, /createSerialPanel/);
  assert.match(serialPanel, /syncSerialAutoScrollButton\(autoScrollButton\)/);
  assert.match(serialPanel, /state\.serialAutoScroll = !state\.serialAutoScroll/);
  assert.match(serialPanel, /const serialScrollContainer = serialMonitor;/);
  assert.match(serialPanel, /scrollSerialToBottom\(\)/);
  assert.match(serialPanel, /requestAnimationFrame/);
  assert.match(serialPanel, /appendSerialEvents\(events\)/);
  assert.match(serialPanel, /state\.serialHistory\.push\(\.\.\.events\)/);
  assert.match(serialPanel, /maxEvents = 1000/);
  assert.match(serialPanel, /if \(state\.serialAutoScroll\)/);
  assert.match(serialPanel, /#clearSerialHistory/);
  assert.match(serialPanel, /clearSerialRx\(\)/);
  assert.match(css, /\.panel-card\[data-bottom-panel="serial"\]/);
  assert.match(css, /\.serial-actions/);
  assert.match(css, /\.serial-monitor[\s\S]*overflow-y: auto;/);
  assert.doesNotMatch(css, /\.serial-clear-button\s*\{[\s\S]*position: absolute;/);
  assert.match(adapter, /appendSerialEvents\(result\.serial\.events\.filter/);
  assert.match(adapter, /clearSerialHistory\(\)/);
});

test('web UI renders contextual signals in the inspector', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const signals = readFileSync(join(root, 'apps/web/js/board/signals-panel.js'), 'utf8');
  const pinResolver = readFileSync(join(root, 'apps/web/js/board/pin-resolver.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const signalSnapshot = readFileSync(join(root, 'apps/web/js/simulation/signal-snapshot.js'), 'utf8');

  assert.match(editor, /createSignalsPanel/);
  assert.match(engine, /signalsByComponent: signalSnapshot\.signalsByComponent/);
  assert.match(engine, /signalsByNet: signalSnapshot\.signalsByNet/);
  assert.match(signalSnapshot, /createSignalSnapshot/);
  assert.match(signals, /state\.signalsByComponent\?\.get\(component\.id\)/);
  assert.match(signals, /signalCardsForComponentSnapshot\(snapshot\)/);
  assert.match(signals, /state\.signalsByNet\?\.get\(net\.id\)/);
  assert.match(signals, /terminalSignalCard\(component\)/);
  assert.match(signals, /terminalSignalRow\(component, terminal\)/);
  assert.match(signals, /signalForTerminalNet\(terminalRef, net\)/);
  assert.match(signals, /runtimeSignalForNet\(net\)/);
  assert.match(signals, /state\.electrical\.netReadings\.get\(net\.id\)/);
  assert.match(pinResolver, /runtime\.pinStates/);
  assert.match(pinResolver, /runtime\.analogPinStates/);
  assert.match(signals, /createPinResolver/);
  assert.match(signals, /signal\.name/);
  assert.doesNotMatch(signals, /digitalPinFromTerminal/);
  assert.doesNotMatch(signals, /analogPinFromTerminal/);
  assert.doesNotMatch(signals, /component\.type === 'arduino'/);
  assert.doesNotMatch(signals, /signalCard\('Ultrassom'/);
  assert.doesNotMatch(signals, /D7 \/ TRIG/);
  assert.match(css, /\.inspector-signals/);
  assert.match(css, /\.signal-card/);
});

test('web UI serializes board state to project JSON with separated connection kinds', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const projectActions = readFileSync(join(root, 'apps/web/js/board/project-actions.js'), 'utf8');
  const serializer = readFileSync(join(root, 'apps/web/js/project-serializer.js'), 'utf8');

  assert.match(serializer, /boardToProject\(/);
  assert.match(serializer, /projectToSnapshot\(project\)/);
  assert.match(editor, /createProjectActions/);
  assert.match(projectActions, /saveProjectToLocalStorage\(\)/);
  assert.match(projectActions, /loadProjectFromLocalStorage\(\)/);
  assert.match(projectActions, /exportProjectFile\(\)/);
  assert.match(projectActions, /importProjectFile\(event\)/);
  assert.match(serializer, /partitionNetsByKind\(nets\)/);
  assert.match(serializer, /connections: electricalNets\.map/);
  assert.match(serializer, /colorForNet\(net, state\.wires, terminalKind\)/);
  assert.match(serializer, /colorForEnvironmentWire\(source, target, state\.wires\)/);
  assert.match(serializer, /environmentConnections: environmentNets\.flatMap/);
  assert.match(projectActions, /localStorage\.setItem\(storageKey/);
});

test('web UI derives nets, selects them and validates incompatible connections', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const inspector = readFileSync(join(root, 'apps/web/js/board/inspector-panel.js'), 'utf8');
  const wireRouting = readFileSync(join(root, 'apps/web/js/board/wire-routing.js'), 'utf8');
  const nets = readFileSync(join(root, 'apps/web/js/nets.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(nets, /buildNets\(wires, terminalKind\)/);
  assert.match(nets, /union\(parent, from, to\)/);
  assert.match(nets, /findParent\(parent, reference\)/);
  assert.match(editor, /selectNet\(netId\)/);
  assert.match(inspector, /renderNetInspector\(netId\)/);
  assert.match(editor, /areTerminalsConnected\(left, right\)/);
  assert.match(nets, /validateConnection\(wires, terminalKind, from, to\)/);
  assert.match(nets, /curto direto entre power e ground/);
  assert.match(nets, /ENV deve ligar apenas a terminais de sinal/);
  assert.match(editor, /routeWire\(\{\s*fromTerminal: wire\.from,/);
  assert.match(wireRouting, /terminalExitPoint\(from, terminalDefinition\(fromTerminal\)\?\.side, to\)/);
  assert.match(wireRouting, /horizontalEscapePoint/);
  assert.match(wireRouting, /verticalEscapePoint/);
  assert.match(wireRouting, /scoreRoute\(left, fromTerminal, toTerminal, routeContext\)/);
  assert.match(wireRouting, /routeComponentCrossings/);
  assert.match(wireRouting, /routeEndpointComponentNearEdges/);
  assert.doesNotMatch(wireRouting, /\[from, \{ x: to\.x, y: from\.y \}, to\]/);
  assert.match(wireRouting, /segmentIntersectsBounds/);
  assert.match(editor, /inferWireColor\(state\.pendingTerminal, terminal\)/);
  assert.match(css, /stroke: var\(--wire-color, #8ab4ff\)/);
  assert.match(css, /\.wire-group\.selected \.wire/);
});

test('web UI bootstrap stays thin and responsibilities are split by module', () => {
  const bootstrap = readFileSync(join(root, 'apps/web/js/app.js'), 'utf8');
  const files = [
    'apps/web/js/board-editor.js',
    'apps/web/js/board/component-state.js',
    'apps/web/js/board/component-binder.js',
    'apps/web/js/board/component-template.js',
    'apps/web/js/board/console-panel.js',
    'apps/web/js/board/formatters.js',
    'apps/web/js/board/inspector-panel.js',
    'apps/web/js/board/problems-panel.js',
    'apps/web/js/board/project-actions.js',
    'apps/web/js/board/serial-panel.js',
    'apps/web/js/board/signals-panel.js',
    'apps/web/js/board/state.js',
    'apps/web/js/board/viewport-controller.js',
    'apps/web/js/board/wire-routing.js',
    'apps/web/js/components.js',
    'apps/web/js/nets.js',
    'apps/web/js/code-editor.js',
    'apps/web/js/panel-resizer.js',
    'apps/web/js/project-serializer.js',
    'apps/web/js/visual-simulation.js'
  ];

  assert.match(bootstrap, /createBoardEditor\(document\)\.start\(\)\.catch/);
  assert.ok(bootstrap.length < 220);

  for (const file of files) {
    assert.doesNotThrow(() => readFileSync(join(root, file), 'utf8'));
  }
});

test('web UI uses CodeMirror and exposes a resizable bottom panel', () => {
  const editor = readFileSync(join(root, 'apps/web/js/code-editor.js'), 'utf8');
  const boardEditor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const resizer = readFileSync(join(root, 'apps/web/js/panel-resizer.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(editor, /EditorView/);
  assert.match(editor, /cpp\(\)/);
  assert.match(editor, /oneDark/);
  assert.match(boardEditor, /createCodeEditor/);
  assert.match(boardEditor, /createBottomPanelResizer/);
  assert.match(resizer, /--bottom-panel-height/);
  assert.match(css, /grid-template-rows: minmax\(180px, 1fr\) var\(--bottom-panel-height\)/);
  assert.match(css, /\.bottom-resize-handle/);
});

test('bottom panel tabs swap the primary view and keep side panels stacked', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8');
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(html, /data-bottom-panel="code"/);
  assert.match(html, /data-bottom-panel="console"/);
  assert.match(html, /data-bottom-panel="serial"/);
  assert.match(html, /data-bottom-panel="problems"/);
  assert.match(editor, /bindBottomTabs\(\)/);
  assert.match(editor, /activateBottomPanel\(panelName\)/);
  assert.match(css, /grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.runtime-panel\s*{\s*display: contents;/);
  assert.match(css, /\.bottom-view\s*{\s*grid-column: 2;/);
  assert.match(css, /\.bottom-view\.active/);
});

test('web UI exposes board pan and zoom viewport controls', () => {
  const html = readFileSync(join(root, 'apps/web/index.html'), 'utf8');
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const viewport = readFileSync(join(root, 'apps/web/js/board/viewport-controller.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(html, /id="boardViewport"/);
  assert.match(html, /id="componentLayer"/);
  assert.match(editor, /bindBoardViewport\(\)/);
  assert.match(editor, /createViewportController/);
  assert.match(viewport, /handleBoardWheel\(event\)/);
  assert.match(viewport, /Space/);
  assert.match(viewport, /screenToWorld\(clientX, clientY\)/);
  assert.match(editor, /centerViewportOnContent\(\)/);
  assert.match(css, /\.board-viewport/);
  assert.match(css, /\.board\.space-panning/);
  assert.match(css, /\.board\.panning/);
});

test('web server exposes Clang-backed firmware diagnostics and IR endpoint', () => {
  const server = readFileSync(join(root, 'apps/web/server.mjs'), 'utf8');
  const analyzer = readFileSync(join(root, 'apps/web/firmware/clang-analyzer.mjs'), 'utf8');
  const client = readFileSync(join(root, 'apps/web/js/simulation/firmware-analysis-client.js'), 'utf8');

  assert.match(server, /\/api\/firmware\/analyze/);
  assert.match(server, /compileFirmwareIrWithClang/);
  assert.match(analyzer, /clang\+\+/);
  assert.match(analyzer, /-fsyntax-only/);
  assert.match(analyzer, /-ast-dump=json/);
  assert.match(analyzer, /clangAstToFirmwareProgram/);
  assert.match(analyzer, /arduinoShim/);
  assert.match(client, /fetch\('\/api\/firmware\/analyze'/);
});

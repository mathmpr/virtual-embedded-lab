import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  for (const manifest of [
    'components/official/arduino-uno/component.json',
    'components/official/esp32-devkit/component.json',
    'components/official/hc-sr04/component.json',
    'components/official/fc-37-rain-sensor/component.json',
    'components/official/resistor/component.json',
    'components/official/capacitor/component.json',
    'components/official/led-red/component.json',
    'components/official/led-green/component.json',
    'components/official/led-blue/component.json',
    'components/official/distance-range/component.json',
    'components/official/rain-toggle/component.json',
    'components/official/wifi-signal/component.json'
  ]) {
    const component = JSON.parse(readFileSync(join(root, manifest), 'utf8'));

    assert.ok(component.visual.type);
    assert.ok(component.visual.palette.group);
  }

  assert.match(html, /Carregando componentes oficiais/);
  assert.match(script, /loadOfficialComponents/);
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
  assert.match(css, /\.wifi-icon/);
  assert.match(css, /\.wifi-signal/);
  assert.match(css, /\.rain-icon/);
  assert.match(css, /\.rain-toggle/);
  assert.match(css, /\.rain-sensor-icon/);
  assert.match(css, /\.fc37-rain-sensor/);
  assert.match(css, /\.esp32-icon/);
  assert.match(css, /\.esp32-devkit/);
  assert.match(css, /\.built-in-led/);
  assert.match(css, /\.examples-dialog/);
  assert.match(css, /\.example-card/);
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
  const solver = readFileSync(join(root, 'apps/web/js/simulation/electrical-solver.js'), 'utf8');

  assert.match(script, /nextComponentId\(type\)/);
  assert.match(script, /syncComponentCounter\(componentId\)/);
  assert.match(solver, /solveElectricalState\(\{ graph, runtime \}\)/);
  assert.match(solver, /findDrivenHighPins\(\{ runtime, arduino \}\)/);
  assert.match(script, /closest\('/);
  assert.match(script, /input, textarea, select/);
  assert.match(script, /\[data-delete-component\]/);
  assert.match(script, /slider\.addEventListener\('pointerdown'/);
});

test('web UI exposes editable distance, resistor and capacitor properties', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const components = readFileSync(join(root, 'apps/web/js/components.js'), 'utf8');
  const resistor = readFileSync(join(root, 'components/official/resistor/component.json'), 'utf8');
  const capacitor = readFileSync(join(root, 'components/official/capacitor/component.json'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(components, /variants:/);
  assert.match(resistor, /1 kΩ/);
  assert.match(capacitor, /capacitanceMicrofarads/);
  assert.match(capacitor, /4700 µF/);
  assert.match(script, /data-resistor-select/);
  assert.match(script, /data-capacitor-select/);
  assert.match(script, /data-inspector-resistor/);
  assert.match(script, /data-inspector-capacitor/);
  assert.match(script, /data-inspector-distance/);
  assert.match(script, /updateDistanceValue\(component, valueCm/);
  assert.match(script, /updateResistorValue\(component, resistanceOhms/);
  assert.match(script, /updateCapacitorValue\(component, capacitanceMicrofarads/);
  assert.match(css, /\.component-select-row/);
  assert.match(css, /\.editable-property/);
});

test('web UI exposes editable Wi-Fi signal controls', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');
  const firmware = readFileSync(join(root, 'apps/web/js/simulation/firmware-engine.js'), 'utf8');
  const analyzer = readFileSync(join(root, 'apps/web/firmware/clang-analyzer.mjs'), 'utf8');

  assert.match(script, /data-wifi-slider/);
  assert.match(script, /data-wifi-connected/);
  assert.match(script, /Internet ativa/);
  assert.match(script, /data-inspector-wifi-strength/);
  assert.match(script, /data-inspector-wifi-connected/);
  assert.match(script, /updateWifiStrength\(component, strengthPercent/);
  assert.match(script, /updateWifiInternetAvailable\(component, internetAvailable/);
  assert.match(engine, /bindWifiEnvironment\(/);
  assert.match(engine, /graph\.findComponentsByType\('hcsr04'\)\.length > 0/);
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
  assert.match(analyzer, /class WiFiClass/);
  assert.match(analyzer, /stripArduinoIncludes/);
});

test('web UI exposes FC-37 rain controls and runtime bindings', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');

  assert.match(script, /data-rain-active/);
  assert.match(script, /data-rain-intensity/);
  assert.match(script, /data-rain-sensor-state/);
  assert.match(script, /data-inspector-rain-active/);
  assert.match(script, /data-inspector-rain-sensor-active-low/);
  assert.match(script, /updateRainActive\(component/);
  assert.match(script, /updateRainSensorActiveLow\(component/);
  assert.match(script, /signalCard\('FC-37'/);
  assert.match(engine, /bindRainSensors\(/);
  assert.match(engine, /digitalPinConnectedToTerminal/);
  assert.match(engine, /runtime\.driveInput\(binding\.pin, value\)/);
  assert.match(engine, /normalizeRainValue/);
  assert.match(adapter, /updateRainValue\(componentId, value\)/);
});

test('web UI exposes board deletion and history operations', () => {
  const script = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(script, /deleteComponent\(componentId\)/);
  assert.match(script, /deleteWire\(wireId\)/);
  assert.match(script, /undoBoard\(\)/);
  assert.match(script, /redoBoard\(\)/);
  assert.match(script, /recordHistory\(\)/);
  assert.match(css, /\.delete-component/);
  assert.match(css, /\.delete-wire/);
  assert.match(css, /\.wire-hit/);
});

test('web UI resolves distance controls dynamically and renders round terminals', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const environment = readFileSync(join(root, 'apps/web/js/simulation/environment-engine.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(engine, /bindEnvironmentChannels\(/);
  assert.match(engine, /updateDistanceValue\(componentId, valueCm\)/);
  assert.match(environment, /write\(id, value\)/);
  assert.match(adapter, /wasmSimulationSession\?\.updateDistanceValue/);
  assert.match(editor, /simulation\.updateDistanceValue\(component\.id, valueCm\)/);
  assert.doesNotMatch(editor, /updateDistanceValue[\s\S]*simulation\.runSimulation\(\);[\s\S]*updateResistorValue/);
  assert.doesNotMatch(engine, /state\.components\.get\('distance-1'\)\?\.properties\.valueCm/);
  assert.match(css, /appearance: none;/);
  assert.match(css, /aspect-ratio: 1;/);
  assert.match(css, /padding: 0;/);
});

test('web UI simulation is routed through a generic kernel adapter', () => {
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const legacyIr = readFileSync(join(root, 'apps/web/js/simulation/legacy-ir-simulation.js'), 'utf8');
  const runtime = readFileSync(join(root, 'apps/web/js/simulation/arduino-runtime.js'), 'utf8');

  assert.doesNotMatch(adapter, /runProjectSimulation/);
  assert.doesNotMatch(engine, /firmware-engine\.js/);
  assert.doesNotMatch(engine, /compileArduinoFirmware/);
  assert.doesNotMatch(engine, /runArduinoFirmware/);
  assert.match(legacyIr, /Deprecated IR execution adapter/);
  assert.match(legacyIr, /firmware-engine\.js/);
  assert.match(legacyIr, /runLegacyIrProjectSimulation/);
  assert.doesNotMatch(adapter, /d13High/);
  assert.doesNotMatch(adapter, /distanceCm\s*</);
  assert.match(engine, /createCircuitGraph/);
  assert.match(engine, /EnvironmentEngine/);
  assert.match(engine, /Hcsr04Behavior/);
  assert.match(engine, /ArduinoRuntime/);
  assert.match(engine, /applyBoardConstants/);
  assert.match(engine, /firstProgrammableBuiltInLed/);
  assert.match(engine, /LED_BUILTIN: builtInLed\.pin/);
  assert.match(engine, /loopIterations: 3/);
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
  assert.match(adapter, /stopSimulationTimer/);
  assert.match(adapter, /firmwareAnalysisCache/);
  assert.match(adapter, /wasmSimulationSession/);
  assert.match(adapter, /createProjectWasmSimulationSession/);
  assert.match(adapter, /compileFirmwareWasmWithBackend/);
  assert.match(adapter, /firmwareWasm\.ok !== true/);
  assert.match(adapter, /firmware WASM não foi compilado/);
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
  const engine = readFileSync(join(root, 'apps/web/js/simulation/simulation-engine.js'), 'utf8');
  const solver = readFileSync(join(root, 'apps/web/js/simulation/electrical-solver.js'), 'utf8');

  assert.match(engine, /solveElectricalState/);
  assert.match(solver, /solveLedPath/);
  assert.match(solver, /LED ligado a saída HIGH sem resistor em série/);
  assert.match(solver, /curto direto entre 5V e GND/);
  assert.match(editor, /renderComponentReadings\(component\.id\)/);
  assert.match(editor, /formatCurrent\(reading\.currentAmps\)/);
  assert.match(editor, /netReadings/);
});

test('web UI keeps Serial history append-only during runs and RX input', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const adapter = readFileSync(join(root, 'apps/web/js/visual-simulation.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(editor, /serialHistory: \[\]/);
  assert.match(editor, /serialAutoScroll: true/);
  assert.match(editor, /syncSerialAutoScrollButton\(autoScrollButton\)/);
  assert.match(editor, /state\.serialAutoScroll = !state\.serialAutoScroll/);
  assert.match(editor, /const serialScrollContainer = serialMonitor;/);
  assert.match(editor, /scrollSerialToBottom\(\)/);
  assert.match(editor, /requestAnimationFrame/);
  assert.match(editor, /appendSerialEvents\(events\)/);
  assert.match(editor, /state\.serialHistory\.push\(\.\.\.events\)/);
  assert.match(editor, /maxEvents = 1000/);
  assert.match(editor, /if \(state\.serialAutoScroll\)/);
  assert.match(editor, /#clearSerialHistory/);
  assert.match(editor, /clearSerialRx\(\)/);
  assert.match(css, /\.panel-card\[data-bottom-panel="serial"\]/);
  assert.match(css, /\.serial-actions/);
  assert.match(css, /\.serial-monitor[\s\S]*overflow-y: auto;/);
  assert.doesNotMatch(css, /\.serial-clear-button\s*\{[\s\S]*position: absolute;/);
  assert.match(adapter, /appendSerialEvents\(result\.serial\.events\.filter/);
  assert.match(adapter, /clearSerialHistory\(\)/);
});

test('web UI renders contextual signals in the inspector', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(editor, /component\.type === 'arduino'/);
  assert.match(editor, /component\.type === 'hcsr04'/);
  assert.match(editor, /isLedComponent\(component\)/);
  assert.match(editor, /signalCard\('Ultrassom'/);
  assert.match(editor, /signalCard\('LED'/);
  assert.match(editor, /D7 \/ TRIG/);
  assert.match(editor, /D6 \/ ECHO/);
  assert.match(css, /\.inspector-signals/);
  assert.match(css, /\.signal-card/);
});

test('web UI serializes board state to project JSON with separated connection kinds', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const serializer = readFileSync(join(root, 'apps/web/js/project-serializer.js'), 'utf8');

  assert.match(serializer, /boardToProject\(/);
  assert.match(serializer, /projectToSnapshot\(project\)/);
  assert.match(editor, /saveProjectToLocalStorage\(\)/);
  assert.match(editor, /loadProjectFromLocalStorage\(\)/);
  assert.match(editor, /exportProjectFile\(\)/);
  assert.match(editor, /importProjectFile\(event\)/);
  assert.match(serializer, /partitionNetsByKind\(nets\)/);
  assert.match(serializer, /connections: electricalNets\.map/);
  assert.match(serializer, /colorForNet\(net, state\.wires, terminalKind\)/);
  assert.match(serializer, /colorForEnvironmentWire\(source, target, state\.wires\)/);
  assert.match(serializer, /environmentConnections: environmentNets\.flatMap/);
  assert.match(editor, /localStorage\.setItem\(storageKey/);
});

test('web UI derives nets, selects them and validates incompatible connections', () => {
  const editor = readFileSync(join(root, 'apps/web/js/board-editor.js'), 'utf8');
  const nets = readFileSync(join(root, 'apps/web/js/nets.js'), 'utf8');
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(nets, /buildNets\(wires, terminalKind\)/);
  assert.match(nets, /union\(parent, from, to\)/);
  assert.match(nets, /findParent\(parent, reference\)/);
  assert.match(editor, /selectNet\(netId\)/);
  assert.match(editor, /renderNetInspector\(netId\)/);
  assert.match(editor, /areTerminalsConnected\(left, right\)/);
  assert.match(nets, /validateConnection\(wires, terminalKind, from, to\)/);
  assert.match(nets, /curto direto entre power e ground/);
  assert.match(nets, /ENV deve ligar apenas a terminais de sinal/);
  assert.match(editor, /routeWire\(wire\.from, wire\.to, from, to\)/);
  assert.match(editor, /terminalExitPoint\(from, terminalDefinition\(fromTerminal\)\?\.side, to\)/);
  assert.match(editor, /horizontalEscapePoint/);
  assert.match(editor, /verticalEscapePoint/);
  assert.match(editor, /scoreRoute\(left, fromTerminal, toTerminal\)/);
  assert.match(editor, /routeComponentCrossings/);
  assert.match(editor, /routeEndpointComponentNearEdges/);
  assert.doesNotMatch(editor, /\[from, \{ x: to\.x, y: from\.y \}, to\]/);
  assert.match(editor, /segmentIntersectsBounds/);
  assert.match(editor, /inferWireColor\(state\.pendingTerminal, terminal\)/);
  assert.match(css, /stroke: var\(--wire-color, #8ab4ff\)/);
  assert.match(css, /\.wire-group\.selected \.wire/);
});

test('web UI bootstrap stays thin and responsibilities are split by module', () => {
  const bootstrap = readFileSync(join(root, 'apps/web/js/app.js'), 'utf8');
  const files = [
    'apps/web/js/board-editor.js',
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
  const css = readFileSync(join(root, 'apps/web/styles.css'), 'utf8');

  assert.match(html, /id="boardViewport"/);
  assert.match(html, /id="componentLayer"/);
  assert.match(editor, /bindBoardViewport\(\)/);
  assert.match(editor, /handleBoardWheel\(event\)/);
  assert.match(editor, /Space/);
  assert.match(editor, /screenToWorld\(clientX, clientY\)/);
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

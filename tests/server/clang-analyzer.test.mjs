import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeProjectCode } from '../../apps/web/js/project-serializer.js';
import { runArduinoFirmware } from '../../apps/web/js/simulation/firmware-engine.js';
import { ArduinoRuntime } from '../../apps/web/js/simulation/arduino-runtime.js';
import { EventScheduler, VirtualClock } from '../../apps/web/js/simulation/virtual-time.js';
import { analyzeFirmwareWithClang, compileFirmwareIrWithClang } from '../../apps/web/firmware/clang-analyzer.mjs';
import { clearFirmwareWasmBuildCache, compileFirmwareWasmWithClang } from '../../apps/web/firmware/wasm-compiler.mjs';

const root = new URL('../..', import.meta.url).pathname;
const referenceCode = normalizeProjectCode(JSON.parse(
  readFileSync(join(root, 'examples/hc-sr04-led-distance/project.json'), 'utf8')
).code.files['main.ino']);

test('clang analyzer invokes clang-compatible command and parses diagnostics', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virtual-lab-fake-clang-'));
  const fakeClang = join(dir, 'clang++');

  await writeFile(fakeClang, `#!/usr/bin/env sh
file="$5"
echo "$file:20:7: error: expected ';' after expression" >&2
exit 1
`, 'utf8');
  await chmod(fakeClang, 0o755);

  try {
    const result = await analyzeFirmwareWithClang('void setup() {}\nvoid loop() {}', {
      command: fakeClang
    });

    assert.equal(result.available, true);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].source, 'clang');
    assert.equal(result.diagnostics[0].severity, 'error');
    assert.equal(result.diagnostics[0].message, "expected ';' after expression");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('clang analyzer reports unavailable command without throwing', async () => {
  const result = await analyzeFirmwareWithClang('void setup() {}\nvoid loop() {}', {
    command: 'definitely-missing-clang-for-virtual-lab'
  });

  assert.equal(result.available, false);
  assert.equal(result.diagnostics[0].code, 'CLANG_UNAVAILABLE');
});

test('clang frontend compiles Arduino AST into executable firmware IR', async () => {
  const result = await compileFirmwareIrWithClang(referenceCode);

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.equal(result.program.source, 'clang-ast');
  assert.deepEqual(result.program.pins, {
    trigger: 7,
    echo: 6,
    led: 13
  });

  const clock = new VirtualClock();
  const scheduler = new EventScheduler(clock);
  const runtime = new ArduinoRuntime(clock, scheduler, { driveArduinoPin() {} });

  scheduler.scheduleIn(112, () => runtime.driveInput(6, 'HIGH'));
  scheduler.scheduleIn(3012, () => runtime.driveInput(6, 'LOW'));

  const executed = runArduinoFirmware(runtime, result.program);

  assert.equal(executed.echoDuration, 2900);
  assert.equal(executed.distanceCm, 50);
  assert.equal(executed.ledValue, 'HIGH');
});

test('clang frontend maps Serial member calls into firmware IR', async () => {
  const result = await compileFirmwareIrWithClang(`
    void setup() {
      Serial.begin(115200);
      Serial.println("ready");
    }
    void loop() {
      Serial.print(42);
      Serial.println();
    }
  `);

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.program.setup.map((statement) => statement.name), ['Serial.begin', 'Serial.println']);
  assert.deepEqual(result.program.loop.map((statement) => statement.name), ['Serial.print', 'Serial.println']);
  assert.equal(result.program.setup[1].args[0].value, 'ready');
});

test('clang frontend maps ESP32 WiFi member calls into firmware IR', async () => {
  const result = await compileFirmwareIrWithClang(`
    #include <WiFi.h>

    void setup() {
      WiFi.mode(WIFI_STA);
      WiFi.begin("VirtualLab", "secret");
    }
    void loop() {
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println(WiFi.RSSI());
        WiFi.softAP("VirtualLab-AP", "secret");
      }
    }
  `);

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.program.setup.map((statement) => statement.name), ['WiFi.mode', 'WiFi.begin']);
  assert.equal(result.program.loop[0].type, 'if');
  assert.equal(result.program.loop[0].then[0].name, 'Serial.println');
  assert.equal(result.program.loop[0].then[1].name, 'WiFi.softAP');
});

test('clang frontend normalizes escaped newlines from project JSON firmware', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-wifi-signal/project.json'), 'utf8')
  );
  const result = await compileFirmwareIrWithClang(project.code.files['main.ino']);

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.program.setup.length > 0);
  assert.ok(result.program.loop.length > 0);
  assert.match(result.program.setup.map((statement) => statement.name ?? statement.type).join('\n'), /WiFi.begin/);
  assert.match(result.program.loop.map((statement) => statement.name ?? statement.type).join('\n'), /Serial.println/);
});

test('clang frontend accepts LED_PIN and PIN as implicit LED_BUILTIN aliases when not declared', async () => {
  const result = await compileFirmwareIrWithClang(`
    void setup() {
      pinMode(LED_PIN, OUTPUT);
      pinMode(PIN, OUTPUT);
    }
    void loop() {
      digitalWrite(LED_PIN, HIGH);
      digitalWrite(PIN, LOW);
    }
  `);

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.equal(result.program.inferredConstants.LED_PIN, true);
  assert.equal(result.program.inferredConstants.PIN, true);
  assert.equal(result.program.pins.led, 13);
});

test('clang analyzer accepts Arduino analog pins and analogRead', async () => {
  const result = await analyzeFirmwareWithClang(`
    const int LIGHT_PIN = A0;

    void setup() {
      pinMode(LIGHT_PIN, INPUT);
    }

    void loop() {
      int lightValue = analogRead(LIGHT_PIN);
      Serial.println(lightValue);
    }
  `);

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
});

test('clang analyzer accepts LDR light analog example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/ldr-light-analog/project.json'), 'utf8')
  );
  const result = await analyzeFirmwareWithClang(normalizeProjectCode(project.code.files['main.ino']));

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
});

test('clang analyzer accepts BMP280 Wire example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/bmp280-weather-i2c/project.json'), 'utf8')
  );
  const result = await analyzeFirmwareWithClang(normalizeProjectCode(project.code.files['main.ino']));

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
});

test('clang analyzer accepts external ADC examples', async () => {
  for (const examplePath of [
    'examples/ads1015-single-ended/project.json',
    'examples/ads1115-single-ended/project.json',
    'examples/mcp3008-single-ended/project.json'
  ]) {
    const project = JSON.parse(readFileSync(join(root, examplePath), 'utf8'));
    const result = await analyzeFirmwareWithClang(normalizeProjectCode(project.code.files['main.ino']));

    assert.equal(result.available, true, examplePath);
    assert.equal(result.ok, true, examplePath);
    assert.deepEqual(result.diagnostics, [], examplePath);
  }
});

test('clang wasm compiler invokes wasm32 freestanding build and returns base64 wasm', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virtual-lab-fake-wasm-clang-'));
  const fakeClang = join(dir, 'clang++');

  await writeFile(fakeClang, `#!/usr/bin/env sh
out=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-o" ]; then
    out="$arg"
  fi
  prev="$arg"
done
printf '\\000\\141\\163\\155\\001\\000\\000\\000' > "$out"
exit 0
`, 'utf8');
  await chmod(fakeClang, 0o755);

  try {
    const result = await compileFirmwareWasmWithClang('void setup() {}\nvoid loop() {}', {
      command: fakeClang
    });

    assert.equal(result.available, true);
    assert.equal(result.ok, true);
    assert.equal(result.bytes, 8);
    assert.equal(result.wasmBase64, 'AGFzbQEAAAA=');
    assert.ok(result.exports.includes('__vl_setup'));
    assert.ok(result.exports.includes('__vl_loop'));
    assert.ok(result.imports.includes('digitalWrite'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('clang wasm compiler caches successful builds by source hash', async () => {
  clearFirmwareWasmBuildCache();
  const dir = await mkdtemp(join(tmpdir(), 'virtual-lab-fake-wasm-cache-'));
  const fakeClang = join(dir, 'clang++');
  const countFile = join(dir, 'count.txt');

  await writeFile(fakeClang, `#!/usr/bin/env sh
count_file="${countFile}"
count="$(cat "$count_file" 2>/dev/null || printf 0)"
count="$((count + 1))"
printf '%s' "$count" > "$count_file"
out=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-o" ]; then
    out="$arg"
  fi
  prev="$arg"
done
printf '\\000\\141\\163\\155\\001\\000\\000\\000' > "$out"
exit 0
`, 'utf8');
  await chmod(fakeClang, 0o755);

  try {
    const first = await compileFirmwareWasmWithClang('void setup() {}\nvoid loop() {}', {
      command: fakeClang
    });
    const second = await compileFirmwareWasmWithClang('void setup() {}\nvoid loop() {}', {
      command: fakeClang
    });

    assert.equal(first.ok, true);
    assert.equal(first.cacheHit, false);
    assert.equal(second.ok, true);
    assert.equal(second.cacheHit, true);
    assert.equal(second.cacheKey, first.cacheKey);
    assert.equal(readFileSync(countFile, 'utf8'), '1');
  } finally {
    clearFirmwareWasmBuildCache();
    await rm(dir, { recursive: true, force: true });
  }
});

test('clang wasm compiler can invoke a container sandbox runtime', async () => {
  clearFirmwareWasmBuildCache();
  const dir = await mkdtemp(join(tmpdir(), 'virtual-lab-fake-wasm-sandbox-'));
  const fakeRuntime = join(dir, 'docker');
  const argsFile = join(dir, 'args.json');

  await writeFile(fakeRuntime, `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
const args = process.argv.slice(2);
writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));
const outIndex = process.argv.indexOf('-o');
if (outIndex >= 0) {
  const volumeIndex = args.indexOf('-v');
  const hostWorkspace = args[volumeIndex + 1].split(':')[0];
  const outPath = process.argv[outIndex + 1].replace('/workspace', hostWorkspace);
  writeFileSync(outPath, Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
}
`, 'utf8');
  await chmod(fakeRuntime, 0o755);

  try {
    const result = await compileFirmwareWasmWithClang('void setup() {}\nvoid loop() {}', {
      command: 'clang++',
      sandbox: {
        mode: 'docker',
        runtime: fakeRuntime,
        image: 'virtual-lab-test-toolchain:latest'
      }
    });
    const args = JSON.parse(readFileSync(argsFile, 'utf8'));

    assert.equal(result.ok, true);
    assert.equal(result.sandbox, 'docker');
    assert.equal(result.cacheHit, false);
    assert.ok(args.includes('--network'));
    assert.ok(args.includes('none'));
    assert.ok(args.includes('--memory'));
    assert.ok(args.includes('256m'));
    assert.ok(args.includes('virtual-lab-test-toolchain:latest'));
    assert.ok(args.includes('/workspace/main.ino.cpp'));
  } finally {
    clearFirmwareWasmBuildCache();
    await rm(dir, { recursive: true, force: true });
  }
});

test('clang wasm compiler reports unavailable command without throwing', async () => {
  const result = await compileFirmwareWasmWithClang('void setup() {}\nvoid loop() {}', {
    command: 'definitely-missing-wasm-clang-for-virtual-lab'
  });

  assert.equal(result.available, false);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'WASM_TOOLCHAIN_UNAVAILABLE');
});

test('clang wasm compiler injects board LED_BUILTIN constants before compilation', async () => {
  const result = await compileFirmwareWasmWithClang(`
    void setup() {
      pinMode(PIN, OUTPUT);
    }
    void loop() {
      digitalWrite(PIN, HIGH);
    }
  `, {
    constants: {
      LED_BUILTIN: 2
    }
  });
  const writes = [];
  const modes = [];
  const { instance } = await WebAssembly.instantiate(Buffer.from(result.wasmBase64, 'base64'), {
    env: {
      __vl_pinMode(pin, mode) {
        modes.push([pin, mode]);
      },
      __vl_digitalWrite(pin, value) {
        writes.push([pin, value]);
      },
      __vl_delay() {},
      __vl_millis() {
        return 0;
      },
      __vl_micros() {
        return 0;
      },
      __vl_serialPrint() {},
      __vl_serialPrintln() {},
      __vl_serialPrintInt() {},
      __vl_serialPrintlnInt() {}
    }
  });

  assert.equal(result.ok, true);
  instance.exports.__vl_setup();
  instance.exports.__vl_loop();
  assert.deepEqual(modes, [[2, 1]]);
  assert.deepEqual(writes, [[2, 1]]);
});

test('clang wasm compiler supports HC-SR04 firmware timing primitives', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/hc-sr04-led-distance/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.imports.includes('delayMicroseconds'));
  assert.ok(result.imports.includes('pulseIn'));
  assert.ok(result.imports.includes('digitalRead'));
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports counter blink example with increment and modulo', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-counter-blink/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports ESP32 WiFi example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-wifi-signal/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.imports.includes('wifiBegin'));
  assert.ok(result.imports.includes('wifiRssi'));
  assert.ok(result.imports.includes('serialBegin'));
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports ESP32 WiFi failover example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/esp32-wifi-failover/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']), {
    constants: {
      LED_BUILTIN: 2
    }
  });

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.imports.includes('wifiRssiForSsid'));
  assert.ok(result.imports.includes('wifiInternetAvailable'));
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports FC-37 rain digital example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/fc-37-rain-digital/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.imports.includes('digitalRead'));
  assert.ok(result.imports.includes('serialBegin'));
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports LDR light analog example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/ldr-light-analog/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.imports.includes('analogRead'));
  assert.ok(result.imports.includes('serialBegin'));
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports BMP280 Wire example', async () => {
  const project = JSON.parse(
    readFileSync(join(root, 'examples/bmp280-weather-i2c/project.json'), 'utf8')
  );
  const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));

  assert.equal(result.available, true);
  assert.equal(result.ok, true);
  assert.ok(result.imports.includes('wireBegin'));
  assert.ok(result.imports.includes('bmp280Begin'));
  assert.ok(result.imports.includes('bmp280ReadTemperature'));
  assert.ok(result.imports.includes('bmp280ReadPressure'));
  assert.equal(result.diagnostics.length, 0);
});

test('clang wasm compiler supports external ADC examples', async () => {
  const expectations = [
    ['examples/ads1015-single-ended/project.json', 'adcReadSingleEnded'],
    ['examples/ads1115-single-ended/project.json', 'adcComputeVolts'],
    ['examples/mcp3008-single-ended/project.json', 'mcp3008Read']
  ];

  for (const [examplePath, expectedImport] of expectations) {
    const project = JSON.parse(readFileSync(join(root, examplePath), 'utf8'));
    const result = await compileFirmwareWasmWithClang(normalizeProjectCode(project.code.files['main.ino']));

    assert.equal(result.available, true, examplePath);
    assert.equal(result.ok, true, examplePath);
    assert.ok(result.imports.includes(expectedImport), examplePath);
    assert.equal(result.diagnostics.length, 0, examplePath);
  }
});

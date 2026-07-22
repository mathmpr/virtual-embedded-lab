# Add Components: ESP32 DevKit and Wi-Fi

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve continuar manifest-first, com behaviors, shims e adapters registrados fora do editor e fora do core central.

## Objetivo

Adicionar suporte ao ESP32 DevKitC V4 e a uma fonte ambiental standalone de Wi-Fi. O objetivo é permitir exemplos com firmware Arduino-compatible em WASM usando GPIO, Serial, Wi-Fi inicial e LED interno controlado por GPIO.

- Componentes adicionados: ESP32 DevKitC V4 e Wi-Fi Signal.
- Cenários principais: scan/conexão Wi-Fi, leitura de RSSI, teste de internet ativa e blink/counter usando `LED_BUILTIN`.
- Exemplos esperados: `esp32-wifi-signal`, `esp32-wifi-failover` e `esp32-counter-blink`.
- O caminho principal de execução deve ser WASM; IR JS fica apenas como fallback/debug temporário.

## ESP32 DevKitC V4

### Identidade

- `identity.id`: `board.esp32.devkit`.
- `identity.name`: `ESP32 DevKitC V4`.
- `identity.category`: `microcontroller`.
- `identity.subCategory`: `esp32`.
- Caminho: `components/official/esp32-devkit/component.json`.

### Papel na Simulação

- `simulation.kind`: `microcontroller`.
- `simulation.effects`: `firmware`, `electrical`, `environment`, `visual-state`.
- `simulation.implemented`: `true`.

Regras:

- Deve declarar `behavior.pinMap` completo por terminal.
- Deve declarar capacidades de pino no manifest, não por regex.
- Deve declarar barramentos em `behavior.buses`.
- Deve declarar built-in LEDs em `behavior.builtInLeds`.
- Deve declarar `electricalModel` com tensão lógica de 3.3 V e corrente recomendada por pino.

### Pinos e Barramentos

O manifest deve representar os headers reais usados pela UI e pelo resolver de capacidades.

- GPIO digitais: `io0`, `io2`, `io4`, `io5`, `io12` a `io19`, `io21` a `io23`, `io25` a `io27`, `io32`, `io33`.
- Entradas analógicas: `vp`, `vn`, `io34`, `io35` e GPIOs com ADC conforme `pinMap`.
- Power: `3v3`, `5v`, múltiplos `gnd`.
- UART0: `rx`/GPIO3 e `tx`/GPIO1.
- I2C padrão: `io21` como SDA e `io22` como SCL.
- SPI: VSPI e HSPI declarados em `behavior.buses.spi`.
- Capacidades preparadas: I2C, SPI, PWM, ADC, timers e interrupções.
- Pinos reservados de flash devem existir visualmente, mas marcados como `flash-reserved`.

### Built-in LEDs

- `PWR`: LED de alimentação, sempre ativo, sem GPIO controlável.
- `LD`: LED programável associado ao GPIO2/`LED_BUILTIN`, ativo em HIGH.

O blink clássico deve funcionar por firmware WASM com `digitalWrite(LED_BUILTIN, HIGH/LOW)` e respeitar `delay`.

## Wi-Fi Signal

### Identidade

- `identity.id`: `environment.wifi-signal`.
- `identity.name`: `Wi-Fi Signal`.
- `identity.category`: `environment`.
- `identity.subCategory`: `wireless`.
- Caminho: `components/official/wifi-signal/component.json`.

### Papel na Simulação

- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`, `firmware`.
- `simulation.implemented`: `true`.

### Propriedades

| property | type | default | significado |
| --- | --- | --- | --- |
| `ssid` | string | `VirtualLab` | rede simulada disponível |
| `connected` | boolean | `true` | internet ativa/disponível, não força do sinal |
| `strengthPercent` | number | `80` | força do sinal usada para calcular RSSI |

`connected` não deve definir RSSI. Ele representa se a rede conectada possui internet ativa. A força do sinal deve ser calculada por `strengthPercent`.

### UI

- Grupo: `Inputs`.
- Subgrupo: `Wireless`.
- Controles inline por `visual.controls`: SSID/readout, internet ativa e força do sinal.
- Alterações ambientais podem atualizar o runtime sem lógica hardcoded no editor.

## Firmware/WASM

APIs suportadas pelo escopo atual:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `Serial.begin/print/println` | sim | sim | monitor serial TX/RX |
| `pinMode` | sim | sim | GPIO |
| `digitalRead/digitalWrite` | sim | sim | inclui built-in LED |
| `delay`, `millis`, `micros` | sim | sim | tempo virtual sem reset por ambiente |
| `WiFi.mode` | sim | sim | modo station inicial |
| `WiFi.begin` | sim | sim | conecta ao ambiente Wi-Fi |
| `WiFi.status` | sim | sim | usa estado de conexão |
| `WiFi.RSSI` | sim | sim | derivado de `strengthPercent` |
| `WiFi.scanNetworks` | sim | sim | lista redes simuladas |
| `WiFi.internetAvailable` | sim | sim | derivado de `connected` |

Novas APIs devem entrar no registry de shims/imports, não diretamente no compilador ou runner central.

## Exemplos Obrigatórios

- `examples/esp32-wifi-signal/project.json`: lê RSSI e imprime no Serial.
- `examples/esp32-wifi-failover/project.json`: diferencia conexão Wi-Fi e internet ativa.
- `examples/esp32-counter-blink/project.json`: incrementa variável, acende LED apenas em múltiplos de 10 e respeita delay longo.

## Testes Obrigatórios

- [x] JSON válido em `tests/fixtures/json-files.test.ts`.
- [x] Manifest respeita `docs/component-contract.md`.
- [x] ESP32 aparece em `Boards/ESP32`.
- [x] Wi-Fi Signal aparece em `Inputs/Wireless`.
- [x] Pinos e barramentos são resolvidos por manifest.
- [x] Firmware compila pelo caminho WASM.
- [x] Wi-Fi usa shims/adapters registrados.
- [x] Built-in LED responde a `digitalWrite`.
- [x] Exemplos rodam sem depender da IR JS.

## Fora de Escopo Atual

- Stack TCP/IP real.
- Bluetooth funcional.
- FreeRTOS real.
- ADC/PWM/timers/interrupções com fidelidade completa.
- Múltiplas redes Wi-Fi realistas com segurança/autenticação.

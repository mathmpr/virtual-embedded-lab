# Add Component: Arduino Nano

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar Arduino Nano como microcontrolador oficial compacto, compatível com o ecossistema Arduino UNO para a maior parte dos exemplos.

- Componentes a adicionar: Arduino Nano.
- Cenário principal de uso: substituir Arduino UNO em projetos menores mantendo pinos ATmega328P.
- Exemplo final esperado: Arduino Nano blink em LED built-in e leitura de botão.
- O componente afeta a simulação: sim, como microcontrolador.
- O exemplo precisa rodar em WASM: sim.

## Componente

### Arduino Nano

#### Identidade

- `identity.id`: `board.arduino.nano`.
- `identity.name`: `Arduino Nano`.
- `identity.category`: `microcontroller`.
- `identity.subCategory`: `arduino`.
- Caminho esperado: `components/official/arduino-nano/component.json`.

#### Papel na Simulação

- `simulation.kind`: `microcontroller`.
- `simulation.effects`: `firmware`, `electrical`, `visual-state`.
- `simulation.implemented`: `true`.

#### Terminais

Terminais mínimos esperados:

| grupo | ids |
| --- | --- |
| Digital | `d0` a `d13` |
| Analógico | `a0` a `a7` |
| Alimentação | `vin`, `5v`, `3v3`, `gnd` |
| Reset/referência | `rst`, `aref` |
| I2C | `a4` SDA, `a5` SCL por capacidade |
| SPI | `d10` SS, `d11` MOSI, `d12` MISO, `d13` SCK por capacidade |
| UART | `d0` RX, `d1` TX por capacidade |

`visual.terminals` deve posicionar os pinos nos dois headers laterais.

#### Propriedades

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `logicVoltage` | number | 5 | 3.3 | 5 | `V` | `rerun` | sim |
| `clockMHz` | number | 16 | 8 | 16 | `MHz` | `rerun` | nao |
| `usbPowered` | boolean | true |  |  |  | `rerun` | sim |

#### Modelo Elétrico

- `electricalModel.type`: `microcontroller`.
- `electricalModel.primitive`: `atmega328p-board`.
- Pino digital recomendado: 20 mA por pino, 40 mA absoluto.
- Pinos de alimentação devem fornecer 5 V/3.3 V simplificados como no UNO.

#### Comportamento Simulado

- Reutilizar resolver/capabilities de microcontrolador por manifest.
- `LED_BUILTIN` deve mapear para D13.
- `A0..A7` devem compilar no shim; `A6/A7` são analógicos-only no Nano.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `LED_BUILTIN` | sim | sim | Arduino core | D13 |
| `A0..A7` | sim | sim | Arduino core | A6/A7 analog-only |
| `pinMode/digitalRead/digitalWrite` | sim | sim | Arduino core | GPIO |
| `analogRead` | sim | sim | Arduino core | ADC |
| `Wire` | sim | sim | Wire | A4/A5 por capacidade |
| `SPI` | sim | sim | SPI | D10-D13 por capacidade |

#### Exemplo Obrigatório

##### `examples/arduino-nano-blink-button/project.json`

- Componentes: Arduino Nano, Pull-up Button, LED e resistor.
- Código: botão alterna LED built-in e LED externo.

#### Fora de Escopo

- Bootloader real.
- Diferenças entre clones CH340/FTDI.
- Limites térmicos detalhados.
- EEPROM/ADC ruído real.

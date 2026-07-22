# Add Component: LCD 16x2

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar display LCD 16x2, priorizando o módulo I2C comum para reduzir quantidade de fios no exemplo inicial.

- Componentes a adicionar: LCD 16x2 I2C.
- Cenário principal de uso: Arduino/ESP escreve texto em duas linhas via `LiquidCrystal_I2C`.
- Exemplo final esperado: Arduino UNO exibindo contador e mensagem.
- O componente afeta a simulação: sim, por firmware, I2C e estado visual textual.
- O exemplo precisa rodar em WASM: sim.

## Componente

### LCD 16x2 I2C

#### Identidade

- `identity.id`: `display.lcd.16x2.i2c`.
- `identity.name`: `LCD 16x2 I2C`.
- `identity.category`: `display`.
- `identity.subCategory`: `character-lcd`.
- Caminho esperado: `components/official/lcd-16x2-i2c/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `firmware`, `visual-state`.
- `simulation.implemented`: `true` quando o shim `LiquidCrystal_I2C` estiver disponível.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 30 | power |
| `gnd` | GND | `ground` | bottom | 100 | 120 | ground |
| `sda` | SDA | `i2c-sda` | left | 0 | 62 | signal |
| `scl` | SCL | `i2c-scl` | left | 0 | 92 | signal |

#### Propriedades e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `i2cAddress` | number | 39 | 8 | 119 |  | `rerun` | sim |
| `columns` | number | 16 | 16 | 20 |  | `rerun` | nao |
| `rows` | number | 2 | 2 | 4 |  | `rerun` | nao |
| `backlight` | boolean | true |  |  |  | `live` | sim |
| `line1` | string | `` |  |  |  | `live` | nao |
| `line2` | string | `` |  |  |  | `live` | nao |

Variantes de endereço:

- `0x27` (`39`).
- `0x3F` (`63`).

#### Modelo Elétrico

- `electricalModel.type`: `module`.
- `electricalModel.primitive`: `i2c-display`.
- Corrente aproximada: 20 mA sem backlight, 80 mA com backlight.
- Diagnósticos esperados: sem VCC/GND, barramento I2C sem pull-up quando o solver suportar, endereço duplicado.

#### Comportamento Simulado

- O runtime registra dispositivo I2C por `i2cAddress`.
- `lcd.init`, `lcd.begin`, `lcd.backlight`, `lcd.noBacklight`, `lcd.setCursor`, `lcd.print`, `lcd.clear` atualizam buffer visual.
- Buffer deve ter 2 linhas de 16 caracteres truncadas/padded.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `#include <Wire.h>` | sim | sim | Wire | barramento I2C |
| `#include <LiquidCrystal_I2C.h>` | sim | sim | LCD | biblioteca nova |
| `LiquidCrystal_I2C(addr, cols, rows)` | sim | sim | LCD | construtor |
| `lcd.init/begin` | sim | sim | LCD | inicializa |
| `lcd.setCursor` | sim | sim | LCD | cursor |
| `lcd.print` | sim | sim | LCD | texto |
| `lcd.clear` | sim | sim | LCD | limpa buffer |

#### Exemplo Obrigatório

##### `examples/arduino-lcd-16x2-i2c-counter/project.json`

- Componentes: Arduino UNO e LCD 16x2 I2C.
- Conexões: `A4 -> SDA`, `A5 -> SCL`, `5V -> VCC`, `GND -> GND`.
- Código: mostra `Virtual Lab` na linha 1 e contador na linha 2.

#### Fora de Escopo

- LCD paralelo 4-bit na primeira entrega.
- Caracteres customizados.
- CGRAM/DDRAM completo.
- Timing real do controlador HD44780.

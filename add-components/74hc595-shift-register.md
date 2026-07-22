# Add Component: 74HC595 Shift Register

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar suporte ao registrador de deslocamento 74HC595 para expandir saídas digitais.

- Componentes a adicionar: 74HC595.
- Cenário principal de uso: Arduino controla LEDs ou display 7 segmentos usando DATA/CLOCK/LATCH.
- Exemplo final esperado: Arduino UNO + 74HC595 + display 7 segmentos contando de 0 a 9.
- O componente afeta a simulação: sim, por firmware, lógica digital e estado visual.
- O exemplo precisa rodar em WASM: sim.

## Componente

### 74HC595

#### Identidade

- `identity.id`: `ic.shift-register.74hc595`.
- `identity.name`: `74HC595 Shift Register`.
- `identity.category`: `ic`.
- `identity.subCategory`: `shift-register`.
- Caminho esperado: `components/official/74hc595/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `firmware`, `visual-state`.
- `simulation.implemented`: `true`.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | top | 80 | 0 | power |
| `gnd` | GND | `ground` | bottom | 80 | 140 | ground |
| `ds` | DS | `digital-input` | left | 0 | 30 | signal |
| `shcp` | SHCP | `digital-input` | left | 0 | 58 | signal |
| `stcp` | STCP | `digital-input` | left | 0 | 86 | signal |
| `oe` | OE | `digital-input` | left | 0 | 114 | signal |
| `mr` | MR | `digital-input` | right | 160 | 30 | signal |
| `q0`..`q7` | Q0..Q7 | `digital-output` | right | 160 | 44..128 | signal |
| `q7s` | Q7S | `digital-output` | bottom | 124 | 140 | signal |

No manifest real, declarar `q0` a `q7` individualmente, não como range.

#### Propriedades e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `latchedValue` | number | 0 | 0 | 255 |  | `live` | nao |
| `shiftValue` | number | 0 | 0 | 255 |  | `live` | nao |
| `outputEnabled` | boolean | true |  |  |  | `live` | sim |
| `clearActiveLow` | boolean | true |  |  |  | `rerun` | nao |

Controles:

- Readout binário/hex de `latchedValue`.
- Badges por saída Q0..Q7.

#### Modelo Elétrico

- `electricalModel.type`: `logic-ic`.
- `electricalModel.primitive`: `shift-register`.
- Tensão lógica: 2 V a 6 V.
- Corrente por saída deve ser limitada.
- Diagnósticos esperados: VCC/GND ausente, saída sobrecarregada, OE/MR flutuantes.

#### Comportamento Simulado

- Detectar borda de subida em `shcp`: desloca `shiftValue` e lê `ds`.
- Detectar borda de subida em `stcp`: copia `shiftValue` para `latchedValue`.
- `oe` LOW habilita saídas; HIGH coloca saídas em alta impedância lógica simplificada.
- `mr` LOW limpa registrador quando `clearActiveLow = true`.
- Saídas Q0..Q7 devem alimentar nets digitais reais.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `pinMode` | sim | sim | Arduino core | controle |
| `digitalWrite` | sim | sim | Arduino core | DATA/CLOCK/LATCH |
| `shiftOut(dataPin, clockPin, bitOrder, value)` | sim | sim | Arduino core | importante |
| `MSBFIRST/LSBFIRST` | sim | sim | Arduino core | constantes |
| `delay` | sim | sim | Arduino core | contador |

`shiftOut` deve ser adicionado ao shim Arduino se ainda não existir.

#### Exemplo Obrigatório

##### `examples/arduino-74hc595-seven-segment-counter/project.json`

- Componentes: Arduino UNO, 74HC595, 7-Segment Display e resistores.
- Conexões: `D8 -> STCP`, `D11 -> DS`, `D12 -> SHCP`, Q0..Q7 nos segmentos.
- Código: usa `shiftOut` para contar de 0 a 9.

#### Fora de Escopo

- Cascateamento de múltiplos 74HC595 na primeira entrega.
- Timing nanosegundo real.
- Estado tri-state elétrico completo.
- Limites térmicos detalhados.

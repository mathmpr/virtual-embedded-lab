# Add Component: 7-Segment LED Display

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar display LED de 7 segmentos de um dígito, com suporte a comum cátodo e comum ânodo.

- Componentes a adicionar: 7-Segment LED Display.
- Cenário principal de uso: Arduino controla segmentos diretamente ou via 74HC595.
- Exemplo final esperado: Arduino UNO conta de 0 a 9 acionando segmentos.
- O componente afeta a simulação: sim, por elétrica, firmware e estado visual.
- O exemplo precisa rodar em WASM: sim.

## Componente

### 7-Segment LED Display

#### Identidade

- `identity.id`: `display.led.7segment`.
- `identity.name`: `7-Segment LED Display`.
- `identity.category`: `display`.
- `identity.subCategory`: `led-display`.
- Caminho esperado: `components/official/seven-segment-display/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `firmware`, `visual-state`.
- `simulation.implemented`: `true`.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `a` | A | `digital-input` | left | 0 | 20 | signal |
| `b` | B | `digital-input` | left | 0 | 42 | signal |
| `c` | C | `digital-input` | left | 0 | 64 | signal |
| `d` | D | `digital-input` | left | 0 | 86 | signal |
| `e` | E | `digital-input` | right | 120 | 20 | signal |
| `f` | F | `digital-input` | right | 120 | 42 | signal |
| `g` | G | `digital-input` | right | 120 | 64 | signal |
| `dp` | DP | `digital-input` | right | 120 | 86 | signal |
| `com1` | COM | `common` | bottom | 46 | 120 | ground |
| `com2` | COM | `common` | bottom | 74 | 120 | ground |

#### Propriedades e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `commonType` | string | `cathode` |  |  |  | `rerun` | sim |
| `forwardVoltageVolts` | number | 2 | 1.6 | 3.4 | `V` | `rerun` | sim |
| `recommendedCurrentAmps` | number | 0.01 | 0.001 | 0.03 | `A` | `rerun` | sim |

Variantes:

- `common-cathode`.
- `common-anode`.

#### Modelo Elétrico

- `electricalModel.type`: `multi-led`.
- `electricalModel.primitive`: `seven-segment-led`.
- Cada segmento deve ser tratado como LED individual.
- Diagnósticos esperados: segmento sem resistor, sobrecorrente por segmento, COM não conectado, polaridade incompatível com `commonType`.

#### Comportamento Simulado

- Estado visual de cada segmento deriva do sinal elétrico do respectivo terminal.
- Para comum cátodo: segmento acende quando terminal de segmento está HIGH e COM está GND.
- Para comum ânodo: segmento acende quando COM está VCC e terminal de segmento está LOW.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `pinMode` | sim | sim | Arduino core | segmentos |
| `digitalWrite` | sim | sim | Arduino core | acende/apaga |
| `delay` | sim | sim | Arduino core | contador |

#### Exemplo Obrigatório

##### `examples/arduino-seven-segment-counter/project.json`

- Componentes: Arduino UNO, 7-Segment Display, 8 resistores.
- Código: conta de 0 a 9.

#### Fora de Escopo

- Multiplexação de múltiplos dígitos na primeira entrega.
- Brilho por PWM.
- Ghosting e persistência visual.

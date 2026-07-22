# Add Component: Servo Motor

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar suporte a servo motor hobby, começando por servo posicional padrão de 0 a 180 graus.

- Componentes a adicionar: Servo Motor.
- Cenário principal de uso: Arduino/ESP controla posição via sinal PWM/Servo.
- Exemplo final esperado: Arduino UNO varrendo o servo de 0 a 180 graus.
- O componente afeta a simulação: sim, por firmware, estado visual, elétrica básica e posição.
- O exemplo precisa rodar em WASM: sim.

## Componente

### Servo Motor

#### Identidade

- `identity.id`: `actuator.servo.motor`.
- `identity.name`: `Servo Motor`.
- `identity.category`: `actuator`.
- `identity.subCategory`: `motors`.
- Caminho esperado: `components/official/servo-motor/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `firmware`, `visual-state`.
- `simulation.implemented`: `true` quando `Servo.attach/write` estiverem no WASM.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 32 | power |
| `gnd` | GND | `ground` | bottom | 90 | 116 | ground |
| `sig` | SIG | `pwm-input` | left | 0 | 68 | signal |

#### Propriedades e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `angleDegrees` | number | 90 | 0 | 180 | `deg` | `live` | sim |
| `minPulseUs` | number | 544 | 300 | 1000 | `us` | `rerun` | sim |
| `maxPulseUs` | number | 2400 | 1800 | 2600 | `us` | `rerun` | sim |
| `stallCurrentAmps` | number | 0.65 | 0 | 5 | `A` | `rerun` | sim |
| `noLoadCurrentAmps` | number | 0.15 | 0 | 2 | `A` | `rerun` | sim |

Controles:

- Readout de ângulo.
- Indicador visual do horn do servo.
- Slider opcional `angleDegrees` para debug/manual quando não houver firmware rodando.

#### Modelo Elétrico

- `electricalModel.type`: `load`.
- `electricalModel.primitive`: `servo-motor`.
- Tensão recomendada: 4.8 V a 6 V para servo hobby comum.
- Diagnósticos esperados: alimentação insuficiente, corrente acima da capacidade do pino/fonte, servo alimentado direto por GPIO.

#### Comportamento Simulado

- `Servo.attach(pin)` associa o pino ao servo conectado em `sig`.
- `Servo.write(angle)` atualiza `angleDegrees`.
- `Servo.writeMicroseconds(us)` converte pulso em ângulo usando `minPulseUs`/`maxPulseUs`.
- O estado visual deve ser atualizado por `visual.stateBindings`.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `#include <Servo.h>` | sim | sim | Servo | biblioteca nova |
| `Servo.attach(pin)` | sim | sim | Servo | registra pino |
| `Servo.write(angle)` | sim | sim | Servo | atualiza posição |
| `Servo.writeMicroseconds(us)` | sim | sim | Servo | opcional na primeira entrega |
| `delay(ms)` | sim | sim | Arduino core | sweep |

#### Exemplo Obrigatório

##### `examples/arduino-servo-sweep/project.json`

- Componentes: Arduino UNO, Servo Motor e fonte/alimentação simplificada.
- Conexões: `D9 -> SIG`, `5V -> VCC`, `GND -> GND`.
- Código: sweep 0, 90, 180 graus e Serial imprime posição.

#### Testes Obrigatórios

- [ ] Manifest válido.
- [ ] Exemplo compila em WASM.
- [ ] Shim `Servo` registra pino e posição.
- [ ] Estado visual reflete ângulo.
- [ ] Solver alerta sobre corrente/fonte quando aplicável.

#### Fora de Escopo

- Torque real.
- Inércia mecânica detalhada.
- Controle contínuo de velocidade.
- Servo 360 graus na primeira entrega.

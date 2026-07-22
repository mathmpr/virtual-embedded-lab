# Add Component: Buzzer

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar suporte a buzzer para feedback sonoro básico em projetos Arduino/ESP.

- Componentes adicionados: Buzzer ativo. Buzzer passivo fica como variante futura.
- Cenário principal de uso: microcontrolador aciona um pino digital ou PWM para emitir som.
- Exemplo final esperado: Arduino UNO alternando beep por botão ou Serial.
- O componente afeta a simulação: sim, por firmware, estado visual e saída sonora opcional via Web Audio na UI.
- O exemplo precisa rodar em WASM: sim.

## Componente

### Buzzer

#### Identidade

- `identity.id`: `actuator.buzzer`.
- `identity.name`: `Buzzer`.
- `identity.category`: `actuator`.
- `identity.subCategory`: `sound`.
- Caminho esperado: `components/official/buzzer/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `firmware`, `visual-state`.
- `simulation.implemented`: `true` para buzzer ativo por `digitalWrite`.

Observação: áudio real é uma camada de apresentação em `apps/web/js/audio/buzzer-audio.js`. O runtime/WASM continua determinístico e apenas define `active`, `frequencyHz` e `volumePercent`.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | + | `power-input` | left | 0 | 34 | power |
| `gnd` | - | `ground` | bottom | 82 | 104 | ground |
| `sig` | SIG | `digital-input` | right | 164 | 54 | signal |

#### Propriedades e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `activeHigh` | boolean | true |  |  |  | `rerun` | sim |
| `frequencyHz` | number | 2000 | 20 | 20000 | `Hz` | `live` | sim |
| `volumePercent` | number | 60 | 0 | 100 | `%` | `live` | sim |
| `activeType` | string | `active` |  |  |  | `rerun` | sim |

Variantes sugeridas:

- `active`: buzzer ativo, liga/desliga por GPIO.
- `passive`: buzzer passivo, depende de PWM/tone.

Controles:

- Readout `ON/OFF`.
- Readout de frequência.
- Classe `is-buzzing` via `visual.stateBindings`.
- Botão global `Audio On/Off` precisa ser ativado pelo usuário para liberar Web Audio no navegador.

#### Modelo Elétrico

- `electricalModel.type`: `load`.
- `electricalModel.primitive`: `buzzer`.
- Tensão recomendada: 3.3 V a 5 V.
- Corrente inicial aproximada: 20 mA.
- Diagnósticos esperados: sem alimentação, sobrecorrente em GPIO, tensão insuficiente e polaridade invertida quando aplicável.

#### Comportamento Simulado

- Para buzzer ativo, `digitalWrite(sig, HIGH)` liga quando `activeHigh = true`.
- Para buzzer passivo, `tone(pin, frequency)` ou `analogWrite` deve produzir frequência/atividade quando o shim existir.
- O estado visual deve ser derivado de sinal/runtime, não de lógica hardcoded no editor.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `pinMode(pin, OUTPUT)` | sim | sim | Arduino core | configura saída |
| `digitalWrite(pin, value)` | sim | sim | Arduino core | liga buzzer ativo |
| `analogWrite(pin, value)` | nao | nao | Arduino core | fora da primeira entrega |
| `tone(pin, frequency)` | nao | nao | Arduino core | fora da primeira entrega |
| `noTone(pin)` | nao | nao | Arduino core | fora da primeira entrega |
| `delay(ms)` | sim | sim | Arduino core | temporização do beep |

`tone`, `noTone` e PWM podem ficar fora da primeira entrega se o exemplo usar buzzer ativo por `digitalWrite`.

#### Exemplo Obrigatório

##### `examples/arduino-buzzer-beep/project.json`

- Componentes: Arduino UNO, Buzzer e resistor opcional.
- Conexões: `D8 -> SIG`, `5V -> +`, `GND -> -`.
- Código: alterna beep a cada 500 ms e imprime `Buzzer ON/OFF`.

#### Testes Obrigatórios

- [x] JSON válido.
- [x] Manifest respeita contrato.
- [x] Exemplo compila em WASM.
- [x] Runtime deriva ON/OFF por `digitalWrite`.
- [x] Inspector mostra estado e frequência.
- [x] UI toca onda quadrada real via Web Audio quando o áudio global está ativado.

#### Fora de Escopo

- Reprodução acústica realista.
- `tone`, `noTone` e `analogWrite`.
- Forma de onda física.
- Curva de volume por tensão.
- Buzzer piezo com modelo analógico completo.

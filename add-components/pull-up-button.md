# Add Components: Pull-up Button

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, não lógica específica no editor/runtime central.

## Objetivo

Adicionar suporte a um botão momentâneo pull-up que envia um pulso digital quando pressionado e retorna automaticamente ao estado físico inicial desligado.

- Componentes adicionados: Pull-up Button.
- Cenário principal de uso: Arduino/ESP32 lê `digitalRead` de um botão momentâneo e executa uma ação por borda de subida.
- Exemplo final esperado: Arduino UNO com Pull-up Button alternando um LED azul.
- O componente afeta a simulação: sim, por firmware, estado visual e validação elétrica inicial.
- O exemplo precisa rodar em WASM: sim.

## Componentes

### Pull-up Button

#### Identidade

- `identity.id`: `input.button.pull-up`.
- `identity.name`: `Pull-up Button`.
- `identity.category`: `input`.
- `identity.subCategory`: `buttons`.
- Caminho esperado: `components/official/pull-up-button/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `electrical`, `visual-state`.
- `simulation.implemented`: `true`.

Regras:

- Deve declarar `behavior`, porque converte ação do usuário em sinal de firmware.
- Deve declarar `electricalModel`, porque possui alimentação e saída digital.
- Deve usar `visual.controls` para o botão inline.
- Não deve adicionar `if (component.type === "pull-up-button")` no editor.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 30 | power |
| `gnd` | GND | `ground` | bottom | 85 | 112 | ground |
| `out` | OUT | `digital-output` | right | 170 | 54 | signal |

#### Propriedades, Variantes e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pressed` | boolean | false |  |  |  | `live` | sim |
| `activeHigh` | boolean | true |  |  |  | `rerun` | sim |

Sem variantes iniciais.

Controles:

- `visual.controls[type="readout"]`: mostra `BTN ON/OFF`.
- `visual.controls[type="pulse"]`: coloca `pressed = true` temporariamente e depois volta para `false`.
- `visual.stateBindings`: aplica classe `is-pressed` enquanto o pulso está ativo.

#### Modelo Elétrico

- `electricalModel.type`: `sensor-module`.
- Tensão lógica inicial: 5 V.
- Corrente aproximada inicial: 1 mA.
- Falhas futuras: sem VCC, sem GND, tensão lógica incompatível e OUT ligado a pino sem capacidade digital.

#### Comportamento Simulado

- `pressed = false`: `OUT` retorna estado inativo.
- `pressed = true`: `OUT` retorna estado ativo durante o pulso.
- `activeHigh = true`: pressionado gera `HIGH`, solto gera `LOW`.
- `activeHigh = false`: pressionado gera `LOW`, solto gera `HIGH`.
- Alterar `pressed` deve atualizar o runtime sem reiniciar a simulação.

O comportamento especializado fica no adapter `momentary-button`.

#### Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `pinMode(pin, INPUT)` | sim | sim | Arduino core | configura pino do botão |
| `digitalRead(pin)` | sim | sim | Arduino core | lê o pulso do botão |
| `digitalWrite(pin, value)` | sim | sim | Arduino core | aciona LED do exemplo |
| `Serial.begin/println` | sim | sim | Serial | logs do exemplo |
| `delay(ms)` | sim | sim | Arduino core | debounce simples |

#### UI e Inspector

- Grupo no catálogo: `Inputs`.
- Subgrupo: `Buttons`.
- Ícone/classe visual: `button-icon`, `pull-up-button`.
- Tamanho padrão: `170x112`.
- Propriedades editáveis no board: botão `Press`.
- Propriedades editáveis no inspector: `pressed`, `activeHigh`.
- Leituras/sinais exibidos no inspector: `OUT`, estado `pressed` e net conectada.
- Estados visuais: pressionado/solto.

#### Exemplos Obrigatórios

##### `examples/arduino-pull-up-button-toggle-blue-led/project.json`

- Nome: `Pull-up Button Toggle Blue LED`.
- Componentes usados: Arduino UNO, Pull-up Button, resistor de `220 Ω` e LED azul.
- Conexões elétricas:
  - `VCC` do botão em `5V`.
  - `GND` do botão em `GND`.
  - `OUT` do botão em `D2`.
  - `D13 -> resistor -> LED azul -> GND`.
- Código `main.ino`:
  - Lê `digitalRead(BUTTON_PIN)`.
  - Detecta borda de subida.
  - Alterna o LED azul.
  - Imprime `Blue LED ON` e `Blue LED OFF`.

#### Testes Obrigatórios

- [x] JSON válido em `tests/fixtures/json-files.test.ts`.
- [x] Manifest respeita `docs/component-contract.md`.
- [x] Componente com `visual.palette` aparece na UI.
- [x] `visual.terminals` bate com `terminals`.
- [x] Exemplo contém os componentes e conexões esperados.
- [x] Firmware compila pelo caminho WASM.
- [x] Runtime simula `digitalRead` do botão.
- [x] Estado visual é atualizado por `visual.stateBindings`.
- [x] Propriedades simples funcionam sem editar `board-editor.js`.

#### Critérios de Aceite

- [x] Pull-up Button aparece em `Inputs/Buttons`.
- [x] Pode ser adicionado ao board.
- [x] Terminais conectam corretamente.
- [x] Propriedades podem ser editadas na UI.
- [x] Exemplo carrega pelo modal `Exemplos`.
- [x] Firmware do exemplo compila em WASM.
- [x] Simulação roda sem fallback para IR JS.
- [x] Pressionar o botão alterna o LED azul.
- [x] Testes passam com `npm test`.

#### Fora de Escopo

- Debounce físico realista.
- Ruído elétrico.
- Pull-up/pull-down interno configurável por `INPUT_PULLUP`.
- Curva temporal analógica do contato mecânico.

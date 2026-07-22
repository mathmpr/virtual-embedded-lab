# Add Components: FC-37 Rain Sensor

## Objetivo

Adicionar suporte ao sensor de chuva FC-37 e a uma fonte ambiental standalone para simular chuva ligada/desligada. O sensor deve poder ser ligado a um microcontrolador e lido por firmware via saída digital e, futuramente, por saída analógica.

- Componentes a adicionar: FC-37 Rain Sensor e Rain Environment.
- Cenário principal de uso: Arduino/ESP32 detecta chuva por `digitalRead` e imprime o estado no Serial.
- Exemplo final esperado: board com microcontrolador, FC-37, ambiente de chuva e `main.ino` alternando mensagem `RAIN DETECTED`/`NO RAIN`.
- O componente deve afetar a simulação: sim, por ambiente, firmware e estado visual.

## Componentes

### FC-37 Rain Sensor

#### Identidade

- `identity.id`: `sensor.rain.fc-37`.
- `identity.name`: `FC-37 Rain Sensor`.
- `identity.category`: `sensor`.
- `identity.subCategory`: `rain`.
- Caminho esperado: `components/official/fc-37-rain-sensor/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `environment`, `visual-state`.
- `simulation.implemented`: `true`.
- Observações: o comportamento inicial deve focar na saída digital `DO`; a saída analógica `AO` pode ser exposta no manifest e entrar como leitura contínua quando `analogRead` estiver implementado.

Regras:

- Deve declarar `behavior`, porque o sensor converte estado ambiental de chuva em sinal de firmware.
- Não precisa de `electricalModel` completo nesta primeira etapa, desde que não participe do solver elétrico além de alimentação/conexão de sinal.
- Deve aparecer em `Sensors/Rain`.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 28 | power |
| `gnd` | GND | `ground` | bottom | 80 | 118 | ground |
| `do` | DO | `digital-output` | right | 170 | 44 | signal |
| `ao` | AO | `analog-output` | right | 170 | 78 | signal |

Notas:

- `DO` representa a saída digital do módulo comparador.
- `AO` representa a saída analógica da placa/superfície de chuva.
- Para Arduino UNO, `DO` deve ligar a pino digital e `AO` deve ligar a pino analógico.
- Para ESP32, `DO` deve ligar a GPIO digital e `AO` deve ligar a pino com suporte analógico real quando o mapeamento por manifest estiver pronto.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `thresholdPercent` | number | 50 | 0 | 100 | `%` | sim |
| `wetAnalogValue` | number | 300 | 0 | 1023 |  | sim |
| `dryAnalogValue` | number | 900 | 0 | 1023 |  | sim |
| `activeLow` | boolean | true |  |  |  | sim |

Sem variantes iniciais.

Notas:

- Muitos módulos FC-37 usam saída digital ativa em nível baixo quando chuva é detectada; por isso `activeLow` deve iniciar como `true`.
- `thresholdPercent` define a fronteira entre seco/molhado para `DO`.
- `wetAnalogValue` e `dryAnalogValue` preparam o manifest para `analogRead`.

#### Modelo Elétrico

Escopo inicial:

- Sem solver elétrico dedicado para a placa FC-37.
- Alimentação recomendada deve ser documentada em `power.recommendedVoltage`.
- O comportamento lógico só deve ser considerado válido quando o sensor estiver alimentado por VCC/GND no grafo.

Campos esperados se o modelo for incluído:

- `electricalModel.type`: `sensor-module`.
- `electricalModel.logicVoltage`: derivado do microcontrolador/alimentação.
- `electricalModel.inputCurrentAmps`: valor aproximado e conservador.

Falhas que devem gerar problema no futuro:

- Sensor sem VCC ou sem GND.
- Tensão acima do recomendado.
- `AO` ligado a pino que não suporta leitura analógica.

#### Comportamento Simulado

O FC-37 deve ler um canal ambiental de chuva.

- Entrada ambiental: `rain`.
- Fonte ambiental esperada: `environment.rain-toggle`.
- Se `rain.active = true`, o sensor considera superfície molhada.
- Se `rain.active = false`, o sensor considera superfície seca.
- `DO` retorna valor digital conforme `activeLow`.
- `AO` retorna `wetAnalogValue` quando molhado e `dryAnalogValue` quando seco.
- O visual do sensor deve indicar `DRY`/`WET`.

Comportamento digital esperado:

| chuva | activeLow | DO |
| --- | --- | --- |
| off | true | HIGH |
| on | true | LOW |
| off | false | LOW |
| on | false | HIGH |

Importante:

- O runtime deve ser genérico para sensores ambientais; regras do FC-37 devem ficar no behavior do componente.
- Alterar a chuva no input ambiental não deve reiniciar a simulação nem resetar o tempo virtual.

#### Firmware/WASM

APIs necessárias:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `pinMode(pin, INPUT)` | sim | sim | configura `DO` como entrada |
| `digitalRead(pin)` | sim | sim | lê `DO` |
| `analogRead(pin)` | sim | sim | lê `AO`; pode ficar fora da primeira entrega se marcado no TODO |
| `Serial.begin(baud)` | sim | sim | exemplo imprime estado |
| `Serial.print/println` | sim | sim | exemplo imprime chuva |
| `delay(ms)` | sim | sim | exemplo roda em loop |

Se `analogRead` ainda não existir no caminho WASM, a primeira entrega deve implementar pelo menos o exemplo digital e deixar `analogRead` como fora de escopo explícito.

#### UI e Inspector

- Grupo no catálogo: `Sensors`.
- Subgrupo: `Rain`.
- Ícone/classe visual: `rain-sensor-icon`, `fc37-rain-sensor`.
- Tamanho padrão: aproximadamente `170x118`.
- Propriedades editáveis no board: indicador `DRY`/`WET`; opcionalmente threshold compacto.
- Propriedades editáveis no inspector: `thresholdPercent`, `activeLow`, `wetAnalogValue`, `dryAnalogValue`.
- Leituras/sinais exibidos no inspector: `DO`, `AO`, estado ambiental recebido, alimentação OK/ausente.
- Estados visuais: placa seca/molhada, saída digital HIGH/LOW.

#### Exemplos Obrigatórios

##### `examples/fc-37-rain-digital/project.json`

- Nome: `FC-37 Rain Digital`.
- Componentes usados: Arduino UNO ou ESP32 DevKit, FC-37 Rain Sensor e Rain Environment.
- Conexões elétricas:
  - VCC do FC-37 em 5V do Arduino UNO, ou 3V3 no ESP32 se o exemplo usar ESP32.
  - GND do FC-37 em GND do microcontrolador.
  - `DO` do FC-37 em um pino digital.
- Conexões ambientais:
  - Rain Environment conectado ao canal ambiental do FC-37, ou standalone lido por binding ambiental se o padrão final seguir Wi-Fi.
- Código `main.ino`:
  - Configura pino `RAIN_PIN`.
  - Lê `digitalRead(RAIN_PIN)`.
  - Imprime `RAIN DETECTED` quando chuva ativa.
  - Imprime `NO RAIN` quando chuva inativa.
- O que deve aparecer no Serial: histórico append-only alternando conforme o usuário liga/desliga chuva.
- O que deve mudar visualmente no board: FC-37 alterna entre `DRY` e `WET`.
- Problemas esperados: sensor sem alimentação deve gerar warning quando essa validação estiver implementada.

Código de referência:

```cpp
const int RAIN_PIN = 7;

void setup()
{
    Serial.begin(115200);
    pinMode(RAIN_PIN, INPUT);
    Serial.println("FC-37 rain sensor ready");
}

void loop()
{
    const int rainState = digitalRead(RAIN_PIN);

    if (rainState == LOW) {
        Serial.println("RAIN DETECTED");
    } else {
        Serial.println("NO RAIN");
    }

    delay(1000);
}
```

##### `examples/fc-37-rain-analog/project.json`

- Nome: `FC-37 Rain Analog`.
- Status: opcional se `analogRead` ainda não estiver implementado.
- Componentes usados: microcontrolador, FC-37 Rain Sensor e Rain Environment.
- Código `main.ino`: lê `analogRead(RAIN_ANALOG_PIN)` e imprime valor bruto.

#### Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo digital contém microcontrolador, FC-37 e Rain Environment.
- [ ] Firmware do exemplo digital compila pelo caminho WASM.
- [ ] Runtime simula `digitalRead` do FC-37 a partir do ambiente de chuva.
- [ ] Alterar chuva no input ambiental não reinicia o tempo virtual.
- [ ] Inspector mostra estado `DRY`/`WET` e saída `DO`.
- [ ] Serial mostra `RAIN DETECTED` e `NO RAIN` conforme o ambiente.
- [ ] `analogRead` é testado se entrar no escopo da entrega.

#### Critérios de Aceite

- [ ] FC-37 aparece em `Sensors/Rain`.
- [ ] Rain Environment aparece em `Inputs/Weather`.
- [ ] Ambos podem ser adicionados ao board.
- [ ] Terminais do FC-37 conectam corretamente.
- [ ] Chuva pode ser ligada/desligada pela UI sem reiniciar a simulação.
- [ ] Exemplo digital carrega pelo modal `Exemplos`.
- [ ] Firmware do exemplo digital compila em WASM.
- [ ] `digitalRead` reflete o estado da chuva.
- [ ] Estado visual do sensor bate com o comportamento simulado.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Medição física real de resistência da placa de chuva.
- Curva analógica realista por intensidade de chuva.
- Corrosão, ruído elétrico, bouncing ou atraso de secagem.
- Calibração real do potenciômetro do módulo.
- `analogRead` completo, caso ainda não seja implementado nesta etapa.

### Rain Environment

#### Identidade

- `identity.id`: `environment.rain-toggle`.
- `identity.name`: `Chuva`.
- `identity.category`: `environment`.
- `identity.subCategory`: `weather`.
- Caminho esperado: `components/official/rain-toggle/component.json`.

#### Papel na Simulação

- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`.
- `simulation.implemented`: `true`.
- Observações: componente standalone, igual ao padrão de Wi-Fi Signal; não precisa de fio elétrico.

#### Terminais

Opção recomendada: sem terminais, como Wi-Fi Signal.

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |

Alternativa se for necessário desenhar vínculo ambiental:

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `rain` | RAIN | `environment-output` | left | 0 | 58 | environment |

Decisão inicial: usar standalone sem terminais, porque a chuva é uma condição global/local de ambiente e evita fios ambientais desnecessários.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `active` | boolean | false |  |  |  | sim |
| `intensityPercent` | number | 100 | 0 | 100 | `%` | sim |

Notas:

- A primeira entrega pode usar apenas `active` on/off.
- `intensityPercent` prepara o caminho para `analogRead` e sensores futuros.

#### Modelo Elétrico

Não possui `electricalModel`. É uma fonte ambiental.

#### Comportamento Simulado

- Publica canal ambiental `rain`.
- `active = false`: sem chuva.
- `active = true`: chuva ativa.
- `intensityPercent`: intensidade futura, usada para leitura analógica ou outros sensores.
- Alterações devem atualizar a simulação em tempo real sem resetar o firmware.

#### Firmware/WASM

Não expõe APIs diretamente. O firmware acessa o efeito da chuva por sensores, como FC-37, via `digitalRead`/`analogRead`.

#### UI e Inspector

- Grupo no catálogo: `Inputs`.
- Subgrupo: `Weather`.
- Ícone/classe visual: `rain-icon`, `rain-toggle`.
- Tamanho padrão: aproximadamente `180x104`.
- Propriedades editáveis no board: toggle `Rain ON/OFF`.
- Propriedades editáveis no inspector: `active`, `intensityPercent`.
- Leituras/sinais exibidos no inspector: estado da chuva e intensidade.
- Estados visuais: seco/chovendo.

#### Exemplos Obrigatórios

Usado pelo exemplo `examples/fc-37-rain-digital/project.json`.

#### Testes Obrigatórios

- [ ] JSON válido.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Aparece em `Inputs/Weather`.
- [ ] UI permite alternar `active`.
- [ ] Alteração de `active` atualiza sensores dependentes sem resetar tempo virtual.

#### Critérios de Aceite

- [ ] Rain Environment aparece no catálogo.
- [ ] Pode ser adicionado ao board.
- [ ] Toggle de chuva funciona no board e no inspector.
- [ ] FC-37 responde ao estado de chuva.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Simulação climática complexa.
- Chuva por região espacial do board.
- Variação automática por tempo.

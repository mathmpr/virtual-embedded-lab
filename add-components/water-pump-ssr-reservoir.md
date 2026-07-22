# Add Components: Water Pump, Solid State Relay and Water Reservoir

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, não lógica específica no editor/runtime central.

## Objetivo

Adicionar um conjunto inicial para simular acionamento de bomba de água por microcontrolador usando relé de estado sólido de um canal e um reservatório simples.

- Componentes a adicionar: Water Pump, 1-Channel Solid State Relay e Water Reservoir.
- Cenário principal de uso: Arduino/ESP32 aciona um relé SSR por GPIO; o relé liga/desliga uma bomba; a bomba transfere água para ou de um reservatório.
- Exemplo final implementado: ESP32 sender, ESP8266 asker, broker MQTT real, SSR, bomba, reservatório e sensores FC-37.
- O componente deve afetar a simulação: sim, por firmware, estado visual, elétrica básica e ambiente/fluido simplificado.
- O exemplo precisa rodar em WASM: sim.

## Escopo Inicial

Nesta primeira etapa, ignorar AC, fases, neutro e frequência da rede.

Modelo inicial:

- Bomba tem estado `on/off`.
- Bomba declara capacidade de bombeamento por hora.
- SSR tem entrada lógica e saída chaveada simplificada.
- Reservatório declara apenas capacidade máxima de líquido.
- O runtime pode calcular volume transferido por tempo virtual usando vazão da bomba.

Fora do escopo inicial:

- AC real, fase/neutro/terra.
- Curva hidráulica por altura/manométrica.
- Pressão, cavitação, vazamento ou perdas.
- Proteções elétricas reais.
- Simulação de motor AC/DC detalhada.

## Componentes

### Water Pump

#### Identidade

- `identity.id`: `actuator.water-pump`.
- `identity.name`: `Water Pump`.
- `identity.category`: `actuator`.
- `identity.subCategory`: `water`.
- Caminho esperado: `components/official/water-pump/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `environment`, `visual-state`.
- `simulation.implemented`: `true`.

Regras:

- Deve declarar `behavior`, porque altera um canal/estado hidráulico simplificado.
- Deve declarar `electricalModel`, porque consome energia e pode ser ligada/desligada por relé.
- Deve usar `properties` e `visual.controls` para estado e vazão, sem lógica específica no editor.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vin` | VIN | `power-input` | left | 0 | 34 | power |
| `gnd` | GND | `ground` | bottom | 90 | 118 | ground |
| `inlet` | IN | `fluid-input` | left | 0 | 78 | signal |
| `outlet` | OUT | `fluid-output` | right | 180 | 78 | signal |

#### Propriedades, Variantes e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `enabled` | boolean | false |  |  |  | `live` | sim |
| `flowLitersPerHour` | number | 240 | 0 | 10000 | `L/h` | `live` | sim |
| `nominalVoltageVolts` | number | 5 | 3 | 24 | `V` | `rerun` | sim |
| `currentAmps` | number | 0.5 | 0 | 10 | `A` | `rerun` | sim |

Variantes futuras para `flowLitersPerHour`:

- `120 L/h`.
- `240 L/h`.
- `400 L/h`.
- `800 L/h`.
- `1200 L/h`.

Controles:

- Readout de `ON/OFF`.
- Slider/select para `flowLitersPerHour`.
- Estado visual `is-running` via `visual.stateBindings`.

#### Modelo Elétrico

- `electricalModel.type`: `load`.
- `electricalModel.primitive`: `motor-pump`.
- Propriedades usadas pelo solver: `nominalVoltageVolts`, `currentAmps`.
- Falhas esperadas: sem alimentação, sobrecorrente, tensão insuficiente e acionamento direto por GPIO sem driver/relé adequado.

#### Comportamento Simulado

- Quando `enabled = true` e a bomba está alimentada, gera fluxo.
- Volume bombeado por frame: `flowLitersPerHour / 3600000 * elapsedMs`.
- Se conectada a reservatório, incrementa/decrementa volume conforme direção do fluxo.
- Se não houver reservatório, apenas expõe estado visual e leitura de fluxo.

O comportamento especializado deve ficar em adapter `water-pump`.

### 1-Channel Solid State Relay

#### Identidade

- `identity.id`: `module.relay.ssr.one-channel`.
- `identity.name`: `1-Channel Solid State Relay`.
- `identity.category`: `module`.
- `identity.subCategory`: `relay`.
- Caminho esperado: `components/official/solid-state-relay-1ch/component.json`.

#### Papel na Simulação

- `simulation.kind`: `active-electrical`.
- `simulation.effects`: `electrical`, `firmware`, `visual-state`.
- `simulation.implemented`: `true`.

Regras:

- Deve declarar `behavior`, porque converte entrada lógica em saída chaveada.
- Deve declarar `electricalModel`, porque isola entrada lógica e carga.
- O modelo inicial ignora AC/fases e trata a saída como chave DC simplificada.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 28 | power |
| `gnd` | GND | `ground` | bottom | 88 | 118 | ground |
| `in` | IN | `digital-input` | left | 0 | 62 | signal |
| `loadIn` | LOAD+ | `switched-input` | right | 176 | 44 | signal |
| `loadOut` | LOAD- | `switched-output` | right | 176 | 82 | signal |

#### Propriedades, Variantes e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `activeHigh` | boolean | true |  |  |  | `rerun` | sim |
| `ratedCurrentAmps` | number | 2 | 0 | 40 | `A` | `rerun` | sim |
| `ratedVoltageVolts` | number | 24 | 0 | 240 | `V` | `rerun` | sim |

Controles:

- Readout de `ON/OFF` derivado do sinal `in`.
- Estado visual `is-active` via `visual.stateBindings`.

#### Modelo Elétrico

- `electricalModel.type`: `switch`.
- `electricalModel.primitive`: `solid-state-relay`.
- Entrada lógica: `in`, `vcc`, `gnd`.
- Saída chaveada: `loadIn`/`loadOut`.
- Falhas esperadas: entrada flutuante, carga acima da corrente nominal, tensão acima da nominal e carga ligada sem alimentação lógica.

#### Comportamento Simulado

- `digitalWrite(GPIO, HIGH)` no pino ligado ao `in` ativa o relé quando `activeHigh = true`.
- Quando ativo, `loadIn` e `loadOut` são considerados conectados eletricamente pelo solver.
- Quando inativo, saída fica aberta.
- O estado do SSR pode ligar/desligar a bomba sem reiniciar a simulação.

O comportamento especializado deve ficar em adapter `solid-state-relay`.

### Water Reservoir

#### Identidade

- `identity.id`: `environment.water-reservoir`.
- `identity.name`: `Water Reservoir`.
- `identity.category`: `environment`.
- `identity.subCategory`: `water`.
- Caminho esperado: `components/official/water-reservoir/component.json`.

#### Papel na Simulação

- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`, `visual-state`.
- `simulation.implemented`: `true`.

Regras:

- Deve declarar `behavior`, porque publica/captura volume de água.
- Não precisa de `electricalModel`.
- Pode ser usado sem fios elétricos.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `water` | WATER | `fluid-io` | right | 190 | 70 | signal |

#### Propriedades, Variantes e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `capacityLiters` | number | 10 | 0 | 10000 | `L` | `live` | sim |
| `currentLiters` | number | 0 | 0 | 10000 | `L` | `live` | sim |

Observação: por enquanto o requisito principal é capacidade máxima. `currentLiters` é útil para visualização e para exemplos de bombeamento.

Controles:

- Readout `currentLiters / capacityLiters`.
- Slider para `currentLiters`.
- Campo/slider para `capacityLiters`.
- Estado visual por porcentagem: vazio, parcial, cheio.

#### Modelo Elétrico

Não possui `electricalModel`. É um componente ambiental/hidráulico.

#### Comportamento Simulado

- Armazena volume atual.
- Limita `currentLiters` entre `0` e `capacityLiters`.
- Recebe fluxo positivo/negativo de bombas conectadas.
- Pode emitir warning quando cheio e a bomba continua tentando encher.

O comportamento especializado deve ficar em adapter `water-reservoir`.

## Exemplo Obrigatório

### `examples/esp-water-control-pump-reservoir/project.json`

- Nome: `ESP Water Control Pump Reservoir`.
- Componentes usados: ESP8266 NodeMCU, ESP32 DevKit, Wi-Fi Signal, SSR de um canal, Water Pump, Water Reservoir e dois FC-37 Rain Sensor.
- Conexões elétricas:
  - ESP8266 `D5` no `IN` do SSR.
  - SSR alimentado por `3V3/GND`.
  - Saída chaveada do SSR controla alimentação simplificada da bomba.
  - Bomba ligada ao reservatório por terminal ambiental `water`.
  - Reservatório alimenta dois sensores FC-37: um para detectar chegada de água e outro para detectar overflow.
- Firmwares:
  - ESP8266 `asker` assina `toggle/water`, aciona o SSR e publica status/keepalive.
  - ESP32 `sender` lê os FC-37 e publica `detect/water`, `income/water` e keepalive.
- Dependência externa:
  - Em `network.mqtt.mode: "real"`, o exemplo depende do contrato MQTT/backend do projeto `https://github.com/mathmpr/water-control`.
  - O backend externo identifica usuários pelo token no payload. `asker` e `sender` precisam usar tokens diferentes e válidos.
- O que deve mudar visualmente:
  - SSR alterna `ON/OFF`.
  - Bomba alterna `ON/OFF`.
  - Reservatório altera nível conforme vazão e tempo virtual.

## Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifests respeitam `docs/component-contract.md`.
- [ ] Componentes com `visual.palette` aparecem na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [x] Exemplo contém ESP8266, ESP32, SSR, bomba, reservatório e sensores FC-37.
- [x] Firmware do exemplo compila pelo caminho WASM.
- [x] Runtime simula `digitalWrite` acionando SSR.
- [x] SSR controla estado da bomba.
- [x] Bomba altera volume do reservatório conforme tempo virtual.
- [ ] Solver elétrico reporta carga acima da capacidade do SSR.
- [ ] Propriedades simples funcionam sem editar `board-editor.js`.

## Critérios de Aceite

- [x] Water Pump aparece no catálogo.
- [x] SSR aparece no catálogo.
- [x] Water Reservoir aparece no catálogo.
- [x] Todos podem ser adicionados ao board.
- [x] Terminais conectam corretamente.
- [x] Propriedades podem ser editadas no board/inspector.
- [x] Exemplo carrega pelo modal `Exemplos`.
- [x] Firmware do exemplo compila em WASM.
- [x] Acionar SSR liga/desliga a bomba.
- [x] Bomba atualiza visualmente o reservatório.
- [x] Testes passam com `npm test`.

## Fora de Escopo

- AC, fase, neutro, aterramento e frequência de rede.
- Proteção contra choque/segurança elétrica real.
- Modelo de motor real.
- Pressão hidráulica, altura manométrica e vazão por curva.
- Tubulação com perda de carga.
- Sensores de nível acoplados ao reservatório.

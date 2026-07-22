# Add Components: LDR Light Sensor

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, resolvers e adapters, não lógica específica no editor/runtime central.

## Objetivo

Adicionar suporte a sensor de luminosidade por LDR e a uma fonte ambiental standalone para simular intensidade de luz. O sensor deve poder ser ligado a um microcontrolador e lido por firmware via `analogRead`, refletindo mudanças de luminosidade sem reiniciar a simulação.

- Componentes a adicionar: LDR Light Sensor e Light Environment.
- Cenário principal de uso: Arduino/ESP32 lê luminosidade por `analogRead` e imprime o valor no Serial.
- Exemplo final esperado: board com microcontrolador, LDR, resistor de divisor de tensão, ambiente de luz e `main.ino` alternando mensagens conforme a intensidade.
- O componente deve afetar a simulação: sim, por ambiente, firmware, estado visual e leitura analógica.

## Componentes

### LDR Light Sensor

#### Identidade

- `identity.id`: `sensor.light.ldr`.
- `identity.name`: `LDR Light Sensor`.
- `identity.category`: `sensor`.
- `identity.subCategory`: `light`.
- Caminho esperado: `components/official/ldr-light-sensor/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `environment`, `electrical`, `visual-state`.
- `simulation.implemented`: `true` se `analogRead` for implementado nesta entrega.
- Observações: diferente do FC-37, o LDR é prioritariamente analógico. Um suporte apenas visual não valida bem este componente.

Regras:

- Deve declarar `behavior`, porque converte luminosidade ambiental em leitura de firmware.
- Deve declarar `electricalModel`, porque o LDR é um resistor variável dependente de luz e normalmente precisa de divisor de tensão.
- Deve aparecer em `Sensors/Light`.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

#### Terminais

Opção recomendada para o componente LDR simples, sem módulo:

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `a` | A | `passive` | left | 0 | 52 | signal |
| `b` | B | `passive` | right | 134 | 52 | signal |

Notas:

- O LDR simples não possui VCC/GND próprios; ele participa de um divisor de tensão com resistor.
- Para leitura no Arduino UNO, o ponto médio do divisor deve ligar a um pino analógico, por exemplo `A0`.
- Para ESP32, o ponto médio deve ligar a um pino ADC real quando o mapeamento por manifest estiver pronto.

Alternativa futura para módulo LDR com comparador:

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 28 | power |
| `gnd` | GND | `ground` | bottom | 80 | 118 | ground |
| `do` | DO | `digital-output` | right | 170 | 44 | signal |
| `ao` | AO | `analog-output` | right | 170 | 78 | signal |

Decisão inicial: implementar o LDR simples como resistor variável, porque isso força o projeto a evoluir `analogRead` e o solver de divisor de tensão, que são capacidades centrais para sensores analógicos.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `darkResistanceOhms` | number | 100000 | 1000 | 1000000 | `Ω` | sim |
| `brightResistanceOhms` | number | 1000 | 100 | 10000 | `Ω` | sim |
| `gamma` | number | 0.7 | 0.1 | 2 |  | sim |
| `responseMs` | number | 50 | 0 | 2000 | `ms` | não na primeira entrega |

Variantes sugeridas:

- `Standard 5 mm`: `darkResistanceOhms = 100000`, `brightResistanceOhms = 1000`.
- `High sensitivity`: `darkResistanceOhms = 500000`, `brightResistanceOhms = 500`.
- `Low sensitivity`: `darkResistanceOhms = 50000`, `brightResistanceOhms = 2000`.

Notas:

- A resistência deve diminuir conforme a luz aumenta.
- `gamma` controla a curva entre escuro e claro.
- `responseMs` prepara o caminho para atraso físico futuro, mas pode ficar fora da primeira simulação.

#### Modelo Elétrico

Obrigatório.

Modelo inicial:

- `electricalModel.type`: `variable-resistor`.
- `electricalModel.primitive`: `ldr`.
- Resistência efetiva derivada de `Light Environment.intensityPercent`.
- A leitura analógica deve ser calculada pelo divisor de tensão real do circuito, não por associação fixa de componente.

Topologia mínima esperada para exemplo:

- `5V -> LDR -> A0 -> resistor 10 kΩ -> GND`, ou o inverso.
- Se o LDR estiver no lado de VCC, mais luz aumenta a tensão em `A0`.
- Se o LDR estiver no lado de GND, mais luz diminui a tensão em `A0`.

Falhas que devem gerar problema:

- LDR sem divisor de tensão.
- Pino analógico flutuante.
- Divisor sem VCC ou sem GND.
- Resistência muito baixa causando corrente excessiva.
- Leitura ligada a pino que não suporta analógico.

#### Comportamento Simulado

O LDR deve ler um canal ambiental de luz.

- Entrada ambiental: `light`.
- Fonte ambiental esperada: `environment.light-level`.
- Se `light.intensityPercent = 0`, o sensor usa `darkResistanceOhms`.
- Se `light.intensityPercent = 100`, o sensor usa `brightResistanceOhms`.
- Entre 0 e 100, calcular resistência por curva contínua usando `gamma`.
- O visual do sensor deve indicar `DARK`, `DIM` ou `BRIGHT`.
- Alterar a luz no input ambiental não deve reiniciar a simulação nem resetar o tempo virtual.

Comportamento esperado em divisor com LDR no lado de VCC:

| luz | resistência LDR | tensão no pino analógico | `analogRead` UNO |
| --- | --- | --- | --- |
| 0% | alta | baixa | próximo de 0 |
| 50% | média | média | intermediário |
| 100% | baixa | alta | próximo de 1023 |

Importante:

- O runtime deve expor leitura analógica por pino, não um hack específico para `A0`.
- O solver deve conseguir derivar tensão em pino analógico a partir do grafo.
- Regras do LDR devem ficar no behavior/electricalModel do componente, não hardcoded no core para um exemplo específico.

#### Firmware/WASM

APIs necessárias:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `pinMode(pin, INPUT)` | sim | sim | opcional em pinos analógicos |
| `analogRead(pin)` | sim | sim | leitura principal do LDR |
| `Serial.begin(baud)` | sim | sim | exemplo imprime valor |
| `Serial.print/println` | sim | sim | exemplo imprime leitura e estado |
| `delay(ms)` | sim | sim | exemplo roda em loop |
| `millis()` | sim | opcional | útil para exemplos mais avançados |

Constantes esperadas:

- Arduino UNO: `A0`, `A1`, `A2`, `A3`, `A4`, `A5` devem compilar no shim WASM.
- ESP32: constantes de GPIO/ADC devem seguir o manifest do microcontrolador quando o mapeamento genérico estiver pronto.

Se `analogRead` ainda não existir no caminho WASM, esta entrega deve implementar `analogRead` antes de considerar o LDR pronto.

#### UI e Inspector

- Grupo no catálogo: `Sensors`.
- Subgrupo: `Light`.
- Ícone/classe visual: `ldr-icon`, `ldr-light-sensor`.
- Tamanho padrão: aproximadamente `134x104`.
- Propriedades editáveis no board: opcionalmente variante/sensibilidade.
- Propriedades editáveis no inspector: `darkResistanceOhms`, `brightResistanceOhms`, `gamma`.
- Leituras/sinais exibidos no inspector: resistência atual, luz recebida, tensão analógica, valor `analogRead`.
- Estados visuais: `DARK`, `DIM`, `BRIGHT`, com brilho proporcional.

#### Exemplos Obrigatórios

##### `examples/ldr-light-analog/project.json`

- Nome: `LDR Light Analog`.
- Componentes usados: Arduino UNO, LDR Light Sensor, resistor 10 kΩ e Light Environment.
- Conexões elétricas:
  - 5V do Arduino no terminal `a` do LDR.
  - Terminal `b` do LDR no pino `A0` do Arduino.
  - Terminal `b` do LDR também no terminal `a` do resistor de 10 kΩ.
  - Terminal `b` do resistor em GND.
- Conexões ambientais:
  - Light Environment standalone alimenta o canal ambiental `light`.
- Código `main.ino`:
  - Lê `analogRead(LIGHT_PIN)`.
  - Imprime valor bruto no Serial.
  - Imprime `DARK`, `DIM` ou `BRIGHT`.
- O que deve aparecer no Serial: histórico append-only com valor analógico mudando conforme a luz.
- O que deve mudar visualmente no board: LDR alterna brilho/estado conforme Light Environment.
- Problemas esperados: divisor incompleto deve gerar warning quando a validação estiver implementada.

Código de referência:

```cpp
const int LIGHT_PIN = A0;

void setup()
{
    Serial.begin(115200);
    pinMode(LIGHT_PIN, INPUT);
    Serial.println("LDR light sensor ready");
}

void loop()
{
    const int lightValue = analogRead(LIGHT_PIN);

    Serial.print("LIGHT RAW: ");
    Serial.println(lightValue);

    if (lightValue < 300) {
        Serial.println("DARK");
    } else if (lightValue < 700) {
        Serial.println("DIM");
    } else {
        Serial.println("BRIGHT");
    }

    delay(1000);
}
```

##### `examples/ldr-light-led/project.json`

- Nome: `LDR Light LED`.
- Status: opcional para segunda entrega.
- Componentes usados: Arduino UNO, LDR, resistor divisor, LED, resistor do LED e Light Environment.
- Comportamento: acende LED quando `analogRead` indica ambiente escuro.

#### Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo analógico contém Arduino UNO, LDR, resistor e Light Environment.
- [ ] Firmware do exemplo compila pelo caminho WASM.
- [ ] Shim WASM suporta constantes `A0`..`A5`.
- [ ] Shim/runtime WASM suporta `analogRead`.
- [ ] Runtime calcula `analogRead` a partir da luz e do divisor de tensão.
- [ ] Alterar luz no input ambiental não reinicia o tempo virtual.
- [ ] Inspector mostra resistência atual e valor analógico.
- [ ] Serial mostra `DARK`, `DIM` e `BRIGHT` conforme ambiente.

#### Critérios de Aceite

- [ ] LDR aparece em `Sensors/Light`.
- [ ] Light Environment aparece em `Inputs/Environment` ou `Inputs/Light`.
- [ ] Ambos podem ser adicionados ao board.
- [ ] Terminais do LDR conectam corretamente.
- [ ] Luz pode ser alterada pela UI sem reiniciar a simulação.
- [ ] Exemplo analógico carrega pelo modal `Exemplos`.
- [ ] Firmware do exemplo compila em WASM.
- [ ] `analogRead(A0)` reflete a intensidade de luz via divisor.
- [ ] Estado visual do LDR bate com o comportamento simulado.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Curva física precisa por lux real.
- Temperatura afetando resistência.
- Resposta temporal realista do material.
- Ruído analógico.
- Módulo LDR com comparador digital `DO`.
- Calibração por lux absoluto.

### Light Environment

#### Identidade

- `identity.id`: `environment.light-level`.
- `identity.name`: `Luminosidade`.
- `identity.category`: `environment`.
- `identity.subCategory`: `light`.
- Caminho esperado: `components/official/light-level/component.json`.

#### Papel na Simulação

- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`.
- `simulation.implemented`: `true`.
- Observações: componente standalone, igual ao padrão de Wi-Fi Signal e Rain Environment; não precisa de fio elétrico.

#### Terminais

Opção recomendada: sem terminais, como Wi-Fi Signal e Rain Environment.

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |

Alternativa futura se for necessário desenhar vínculo ambiental:

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `light` | LIGHT | `environment-output` | left | 0 | 58 | environment |

Decisão inicial: usar standalone sem terminais, porque luminosidade é uma condição ambiental do cenário.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `intensityPercent` | number | 50 | 0 | 100 | `%` | sim |
| `enabled` | boolean | true |  |  |  | sim |

Variantes sugeridas:

- `Dark room`: `intensityPercent = 5`.
- `Indoor`: `intensityPercent = 35`.
- `Daylight`: `intensityPercent = 80`.
- `Direct light`: `intensityPercent = 100`.

#### Modelo Elétrico

Não possui `electricalModel`. É uma fonte ambiental.

#### Comportamento Simulado

- Publica canal ambiental `light`.
- `enabled = false`: fonte de luz desativada, equivalente a 0%.
- `enabled = true`: usa `intensityPercent`.
- Alterações devem atualizar a simulação em tempo real sem resetar o firmware.

#### Firmware/WASM

Não expõe APIs diretamente. O firmware acessa o efeito da luz por sensores, como LDR, via `analogRead`.

#### UI e Inspector

- Grupo no catálogo: `Inputs`.
- Subgrupo: `Light`.
- Ícone/classe visual: `light-icon`, `light-level`.
- Tamanho padrão: aproximadamente `190x104`.
- Propriedades editáveis no board: slider `0..100%` e toggle `enabled`.
- Propriedades editáveis no inspector: `enabled`, `intensityPercent`.
- Leituras/sinais exibidos no inspector: estado da luz e intensidade.
- Estados visuais: escuro/fraco/claro.

#### Exemplos Obrigatórios

Usado pelo exemplo `examples/ldr-light-analog/project.json`.

#### Testes Obrigatórios

- [ ] JSON válido.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Aparece em `Inputs/Light`.
- [ ] UI permite alterar `intensityPercent`.
- [ ] Alteração de luz atualiza sensores dependentes sem resetar tempo virtual.

#### Critérios de Aceite

- [ ] Light Environment aparece no catálogo.
- [ ] Pode ser adicionado ao board.
- [ ] Slider de luminosidade funciona no board e no inspector.
- [ ] LDR responde à intensidade de luz.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Luz espacial por posição no board.
- Múltiplas fontes somadas por geometria.
- Simulação em lux real.
- Variação automática por tempo.

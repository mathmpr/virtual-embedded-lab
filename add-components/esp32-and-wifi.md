# Template para Adicionar Novos Componentes

Use este arquivo como modelo para descrever novos componentes antes da implementação. O objetivo é reduzir ambiguidades e evitar componentes parcialmente prontos, por exemplo apenas visuais, quando o esperado é integração com firmware, solver, UI e exemplos.

## Objetivo

Descreva o pacote de componentes e o resultado esperado para o usuário.

- Componentes a adicionar:
- Cenário principal de uso:
- Exemplo final esperado:
- O componente deve ser apenas visual ou deve afetar a simulação?

## Componentes

Repita esta seção para cada componente.

### `<nome do componente>`

#### Identidade

- `identity.id`:
- `identity.name`:
- `identity.category`: `microcontroller`, `sensor`, `environment`, `passive`, `semiconductor`, `actuator`, `display` ou outra categoria justificada.
- `identity.subCategory`:
- Caminho esperado: `components/official/<slug>/component.json`.

#### Papel na Simulação

Preencha conforme `docs/component-contract.md`.

- `simulation.kind`: `visual-only`, `passive-electrical`, `active-electrical`, `behavioral-sensor`, `environment-source` ou `microcontroller`.
- `simulation.effects`: `electrical`, `firmware`, `environment` e/ou `visual-state`.
- `simulation.implemented`: `true` se o comportamento precisa funcionar agora; `false` se entra apenas como manifest/catálogo inicial.
- Observações:

Regras:

- Se tiver `electrical` em `simulation.effects`, deve existir `electricalModel`.
- Se for `microcontroller`, `behavioral-sensor` ou `environment-source`, deve existir `behavior`.
- Se aparecer no catálogo, deve existir `visual.palette`.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

#### Terminais

Liste todos os terminais lógicos e visuais.

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 24 | power |
| `gnd` | GND | `ground` | bottom | 80 | 104 | ground |

Tipos comuns:

- Alimentação: `power-input`, `power-output`, `ground`.
- Sinal digital: `digital-input`, `digital-output`, `digital-io`.
- Sinal analógico: `analog-input`, `analog-output`.
- Barramentos: `i2c-sda`, `i2c-scl`, `spi-mosi`, `spi-miso`, `spi-sck`, `spi-cs`, `uart-io`.
- Ambiente: `environment-input`, `environment-output`.
- Passivo: `passive`, `ground-capable`.

#### Propriedades e Variantes

Liste propriedades editáveis no inspector e, se existir, variantes conhecidas.

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `value` | number | 10 | 0 | 100 | `%` | sim |

Exemplos:

- Resistores usam variantes em ohms com labels como `220 Ω`, `1 kΩ`, `1 MΩ`.
- Capacitores usam variantes em `nF`/`µF`.
- Componentes ambientais usam sliders, checkbox ou campos de texto no board e no inspector.

#### Modelo Elétrico

Obrigatório quando `simulation.effects` contém `electrical`.

Defina se o componente é:

- Passivo simples: resistor, capacitor, indutor.
- Semicondutor: LED, diodo, transistor.
- Fonte/carga: alimentação, buzzer, motor, display.
- Microcontrolador: níveis lógicos, corrente recomendada por pino, pinos de power.

Campos esperados:

- `electricalModel.type`:
- `electricalModel.primitive`:
- Propriedades usadas pelo solver:
- Falhas que devem gerar problema: curto, sobrecorrente, tensão insuficiente, resistência inadequada, potência excedida etc.

#### Comportamento Simulado

Obrigatório para `microcontroller`, `behavioral-sensor` e `environment-source`.

Descreva:

- Como o componente lê entradas.
- Como ele altera saídas.
- Se depende de tempo virtual, eventos ou delays.
- Se depende de ambiente, como distância, temperatura, umidade, luz ou Wi-Fi.
- Se o comportamento precisa ficar dentro de runtime genérico ou em behavior específico do componente.

Importante:

- Não amarre regras específicas dentro do core se elas pertencem ao componente.
- O core deve ser genérico; o manifest e os behaviors devem carregar as diferenças de cada componente.

#### Firmware/WASM

Liste APIs que precisam compilar e executar pelo caminho WASM.

Exemplos:

- GPIO: `pinMode`, `digitalRead`, `digitalWrite`.
- Analógico/PWM: `analogRead`, `analogWrite`, PWM/timers.
- Tempo: `delay`, `delayMicroseconds`, `millis`, `micros`.
- Serial: `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.available`, `Serial.read`.
- Wi-Fi: `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.internetAvailable`.
- I2C: `Wire.begin`, `Wire.write`, `Wire.read`, `Wire.requestFrom`.
- SPI: `SPI.begin`, `SPI.transfer`.

Para cada API:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `analogRead(pin)` | sim | sim | retorna valor do ambiente/sensor |

Se uma API não será implementada agora, declare como fora de escopo.

#### UI e Inspector

Descreva como o componente aparece e como é editado.

- Grupo no catálogo:
- Subgrupo:
- Ícone/classe visual:
- Tamanho padrão:
- Propriedades editáveis no board:
- Propriedades editáveis no inspector:
- Leituras/sinais exibidos no inspector:
- Estados visuais: ligado/desligado, brilho, valor atual, conexão, erro etc.

Para componentes ambientais standalone, deixe explícito se eles precisam ou não de fios.

#### Exemplos Obrigatórios

Cada pacote novo deve ter pelo menos um exemplo em `examples/<slug>/project.json`.

Para cada exemplo:

- Nome:
- Componentes usados:
- Conexões elétricas:
- Conexões ambientais:
- Código `main.ino`:
- O que deve aparecer no Serial:
- O que deve mudar visualmente no board:
- Problemas esperados, se houver:

#### Testes Obrigatórios

Marque o que precisa ser coberto.

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo contém os componentes e conexões esperados.
- [ ] Firmware compila pelo caminho WASM.
- [ ] Runtime simula o comportamento esperado.
- [ ] Solver elétrico detecta falhas relevantes.
- [ ] Inspector mostra propriedades/sinais relevantes.
- [ ] Serial mostra TX/RX esperado, quando aplicável.

#### Critérios de Aceite

Liste condições objetivas para considerar o componente pronto.

- [ ] O componente aparece no catálogo correto.
- [ ] Pode ser adicionado ao board.
- [ ] Terminais conectam corretamente.
- [ ] Propriedades podem ser editadas na UI.
- [ ] Exemplo carrega pelo modal `Exemplos`.
- [ ] Firmware do exemplo compila em WASM.
- [ ] Simulação roda sem fallback para IR.
- [ ] Estado visual bate com o comportamento simulado.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

Declare explicitamente o que não será feito nesta etapa.

- APIs de firmware não suportadas:
- Periféricos não simulados:
- Limitações elétricas conhecidas:
- Limitações visuais:

## Exemplo Preenchido: ESP32 + Wi-Fi Signal

### Wi-Fi Signal

- `identity.id`: `environment.wifi-signal`.
- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`, `firmware`.
- Standalone: não precisa de fios.
- Propriedades: `ssid`, `connected` como internet ativa, `strengthPercent`.
- UI: campo de SSID, checkbox de internet ativa e slider de força do sinal.
- Firmware/WASM: alimenta `WiFi.scanNetworks`, `WiFi.RSSI()`, `WiFi.RSSI(ssid)` e `WiFi.internetAvailable()`.

### ESP32 DevKit

- `identity.id`: `board.esp32.devkit`.
- `simulation.kind`: `microcontroller`.
- `simulation.effects`: `firmware`, `electrical`, `environment`, `visual-state`.
- Terminais: headers reais da placa, power, GND, GPIO, UART e pinos reservados de flash.
- Built-in LEDs: `PWR` fixo e `LD` programável em GPIO2/`LED_BUILTIN`.
- Firmware/WASM: suporte inicial a GPIO, Serial e Wi-Fi.

### Exemplos Criados

- `examples/esp32-wifi-signal/project.json`: ESP32 lê uma rede Wi-Fi e imprime RSSI no Serial.
- `examples/esp32-wifi-failover/project.json`: ESP32 escolhe a melhor rede com internet ativa entre múltiplos sinais.

### Ajustes que o Template Deve Evitar no Futuro

- Não tratar `connected` como força de sinal; conexão/internet ativa e RSSI são conceitos separados.
- Não implementar comportamento específico diretamente no core quando ele pertence ao componente ou ao runtime genérico.
- Não deixar exemplo visual sem firmware WASM funcional.
- Não adicionar componente ao catálogo sem testes de palette e terminais.

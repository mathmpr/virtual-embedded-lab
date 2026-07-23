# Template para Adicionar Novos Componentes

Antes de preencher este template, leia `docs/official-component-guidelines.md`, `docs/component-description.md` e `docs/component-contract.md`. O objetivo é reduzir ambiguidades e impedir componentes parcialmente prontos ou acoplados ao editor/runtime por `if (component.type === "...")`.

## Objetivo

Descreva o pacote de componentes e o resultado esperado para o usuário.

- Componentes a adicionar:
- Cenário principal de uso:
- Exemplo final esperado:
- O componente deve ser apenas visual ou deve afetar a simulação?
- O exemplo precisa rodar em WASM agora?

## Componentes

Repita esta seção para cada componente.

### `<nome do componente>`

#### Identidade

- `identity.id`:
- `identity.name`:
- `identity.category`: `microcontroller`, `sensor`, `environment`, `passive`, `semiconductor`, `actuator`, `display` ou outra categoria justificada.
- `identity.subCategory`:
- Caminho esperado: `components/official/<slug>/component.json`.
- Arquivos extras esperados: `ui/styles.css`, `simulation/behavior.js`, `firmware/library*.json`, `firmware/wasm-imports.js`, `firmware/shims/*.cpp`, conforme necessidade.

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
- Propriedades simples devem vir de `properties`, `variants`, `visual.controls` e `visual.stateBindings`, não de lógica específica no editor.
- CSS, shims, imports WASM e behaviors específicos devem ficar dentro da pasta do componente e ser declarados em `contributions`.

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

#### Propriedades, Variantes e Controles

Liste propriedades editáveis no inspector e, se existir, variantes conhecidas.

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `value` | number | 10 | 0 | 100 | `%` | `live` | sim |

Declare também:

- `variants` para opções fixas, como `220 Ω`, `1 kΩ`, `100 nF` ou `10 µF`.
- `visual.controls` para sliders, checkboxes, selects, campos de texto e readouts inline.
- `visual.stateBindings` para texto/classe derivados de sinais, nets, ambiente ou leitura elétrica.
- `simulationUpdate: "live"` quando a alteração não deve reiniciar o firmware.
- `simulationUpdate: "rerun"` quando a alteração deve reiniciar a simulação.

#### Modelo Elétrico

Obrigatório quando `simulation.effects` contém `electrical`.

Defina se o componente é:

- Passivo simples: resistor, capacitor, indutor.
- Semicondutor: LED, diodo, transistor.
- Fonte/carga: alimentação, buzzer, motor, display.
- Microcontrolador: níveis lógicos, corrente recomendada por pino, pinos de power.
- Módulo/sensor: tensão recomendada, consumo e limites por terminal.

Campos esperados:

- `electricalModel.type`:
- `electricalModel.primitive`:
- Propriedades usadas pelo solver:
- Falhas que devem gerar problema: curto, sobrecorrente, tensão insuficiente, resistência inadequada, potência excedida, entrada flutuante etc.

#### Comportamento Simulado

Obrigatório para `microcontroller`, `behavioral-sensor` e `environment-source`.

Descreva:

- Como o componente lê entradas.
- Como ele altera saídas.
- Se depende de tempo virtual, eventos ou delays.
- Se depende de ambiente, como distância, temperatura, pressão, chuva, luz ou Wi-Fi.
- Que canais ambientais consome ou publica.
- Que terminais ou barramentos usa.
- Qual adapter/registry deve receber o comportamento especializado.

Importante:

- Não amarre regras específicas dentro do core se elas pertencem ao componente.
- O core deve ser genérico; o manifest, os behaviors, os shims e os adapters devem carregar as diferenças.

#### Firmware/WASM

Liste APIs que precisam compilar e executar pelo caminho WASM.

Exemplos:

- GPIO: `pinMode`, `digitalRead`, `digitalWrite`.
- Analógico/PWM: `analogRead`, `analogWrite`, PWM/timers.
- Tempo: `delay`, `delayMicroseconds`, `millis`, `micros`, `pulseIn`.
- Serial: `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.available`, `Serial.read`.
- Wi-Fi: `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.internetAvailable`.
- I2C: `Wire.begin`, `Wire.write`, `Wire.read`, `Wire.requestFrom`.
- SPI: `SPI.begin`, `SPI.transfer`.

Para cada API:

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `analogRead(pin)` | sim | sim | Arduino core | retorna valor do ambiente/sensor |

Se uma API não será implementada agora, declare como fora de escopo.

Arquivos esperados quando houver biblioteca nova:

- `components/official/<slug>/firmware/library.json` ou `library-<name>.json`: headers, identificadores, imports e APIs suportadas.
- `components/official/<slug>/firmware/shims/<name>.cpp`: classe/header C++ mínimo para compilar o sketch.
- `components/official/<slug>/firmware/wasm-imports.js`: registro dos imports WASM usados pelo shim.

Bibliotecas Arduino core, Serial, Wire e SPI pertencem a `apps/web/firmware/core-libraries.json`. Não duplique essas definições dentro do componente.

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
- CSS específico: `components/official/<slug>/ui/styles.css`.
- Entrada no manifest: `contributions.styles.files`.

Para componentes ambientais standalone, deixe explícito se eles precisam ou não de fios.

#### Contribuições

Declare somente as contribuições necessárias.

```json
{
  "contributions": {
    "styles": {
      "files": ["./ui/styles.css"]
    },
    "simulationBehaviors": {
      "modules": ["./simulation/behavior.js"]
    },
    "wasmImports": {
      "modules": ["./firmware/wasm-imports.js"]
    }
  }
}
```

Se o componente reutiliza arquivos de outro componente, use caminho relativo claro, por exemplo `../dht22/ui/styles.css`.

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
- [ ] Propriedades simples funcionam sem editar `board-editor.js`.
- [ ] CSS específico é carregado por `contributions.styles`, sem voltar para `apps/web/styles.css`.
- [ ] Bibliotecas/shims/imports específicos ficam dentro da pasta do componente.

#### Critérios de Aceite

Liste condições objetivas para considerar o componente pronto.

- [ ] O componente aparece no catálogo correto.
- [ ] Pode ser adicionado ao board.
- [ ] Terminais conectam corretamente.
- [ ] Propriedades podem ser editadas na UI.
- [ ] Exemplo carrega pelo modal `Exemplos`.
- [ ] Firmware do exemplo compila em WASM.
- [ ] Simulação roda sem fallback para IR JS.
- [ ] Estado visual bate com o comportamento simulado.
- [ ] Testes passam com `npm test`.
- [ ] A mudança é append-only no componente sempre que não houver capacidade core nova.

#### Fora de Escopo

Declare explicitamente o que não será feito nesta etapa.

- APIs de firmware não suportadas:
- Periféricos não simulados:
- Limitações elétricas conhecidas:
- Limitações visuais:

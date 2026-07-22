# TODO: Remoção de acoplamentos hardcoded

Este TODO acompanha a remoção gradual de código hardcoded ligado a componentes, pinos, tipos visuais, sensores e bibliotecas. A regra geral é: componente novo deve ser descrito por manifest e só deve exigir código específico quando houver comportamento físico, elétrico ou firmware realmente novo.

## Estado base

- [x] Carregar catálogo oficial a partir de `components/official/*/component.json`.
- [x] Expor `propertySchema` em `componentDefinitions` a partir dos manifests.
- [x] Expor `identity` em `componentDefinitions` a partir dos manifests.
- [x] Expor `electricalModel` em `componentDefinitions` a partir dos manifests.
- [x] Fazer a UI usar `propertySchema` como fonte principal para propriedades editáveis.
- [x] Fazer o runtime usar `behavior`, `simulation` e `electricalModel` como fonte principal para descobrir comportamento.
- [x] Runtime cria canais ambientais por `simulation.kind === "environment-source"` e `behavior.channel`.
- [x] Impedir que novos componentes adicionem `if (component.type === "...")` para propriedades simples no inspector.

## `apps/web/js/board-editor.js`

### Separação de responsabilidades

- [x] Criar `apps/web/js/board/` para módulos internos do editor do board.
- [x] Extrair estado inicial e configuração do mundo do board para `board/state.js`.
- [x] Extrair renderização do template visual de componentes para `board/component-template.js`.
- [x] Extrair formatação e normalização de valores da UI para `board/formatters.js`.
- [x] Extrair cálculo de rotas de fios para `board/wire-routing.js`.
- [x] Extrair painel Serial para `board/serial-panel.js`.
- [x] Extrair Console para `board/console-panel.js`.
- [x] Extrair Problemas para `board/problems-panel.js`.
- [x] Extrair viewport, pan e zoom para `board/viewport-controller.js`.
- [x] Extrair bind de componentes e controles inline para `board/component-binder.js`.
- [x] Extrair inspector de propriedades e nets para `board/inspector-panel.js`.
- [x] Extrair monitor de sinais para `board/signals-panel.js`.
- [x] Extrair histórico, undo, redo e import/export para `board/project-actions.js`.
- [x] Extrair estados visuais e updates de propriedades específicas para `board/component-state.js`.

### Renderização visual de componentes

- [x] Remover a cadeia de comparações contra `definition.className` em `renderComponentTemplate()`.
- [x] Criar suporte a `visual.controls` no manifest.
- [x] Renderizar controles inline por tipo de propriedade: `boolean`, `number`, `string` e `variant`.
- [x] Manter customização visual específica em CSS/classes, não em lógica JS.
- [x] Garantir que componentes simples novos possam aparecer no board sem editar `board-editor.js`.

### Inspector de propriedades

- [x] Disponibilizar `componentDefinitions[type].propertySchema`.
- [x] Refatorar `renderEditableProperties()` para gerar campos pelo schema do manifest.
- [x] Usar `variants` do manifest para selects como resistor, capacitor, BMP280 e ADCs.
- [x] Usar `minimum`, `maximum`, `step` e `unit` do schema para configurar inputs.
- [x] Criar labels humanos por schema ou fallback consistente por nome da propriedade.
- [x] Remover `if (component.type === "distance")` do inspector.
- [x] Remover `if (component.type === "resistor")` do inspector.
- [x] Remover `if (component.type === "capacitor")` do inspector.
- [x] Remover `if (component.type === "wifi-signal")` do inspector.
- [x] Remover `if (component.type === "rain-toggle")` do inspector.
- [x] Remover `if (component.type === "fc37-rain-sensor")` do inspector.
- [x] Remover `if (component.type === "light-level")` do inspector.
- [x] Remover `if (component.type === "ldr-light-sensor")` do inspector.
- [x] Remover `if (component.type === "climate-environment")` do inspector.
- [x] Remover `if (component.type === "bmp280-sensor")` do inspector.
- [x] Remover `if (component.type === "analog-voltage-source")` do inspector.
- [x] Remover lógica específica de `ads1015-adc`, `ads1115-adc` e `mcp3008-adc` do inspector.

### Bind de controles inline e inspector

- [x] Trocar seletores específicos por `data-property="nomeDaPropriedade"`.
- [x] Criar um binder genérico para inputs inline do componente.
- [x] Criar um binder genérico para inputs do inspector.
- [x] Criar uma função única de update de propriedade.
- [x] Declarar no manifest se uma propriedade atualiza em runtime sem reset.
- [x] Declarar no manifest se uma propriedade exige rerun/reset da simulação.
- [x] Remover bind específico de `data-distance-slider`.
- [x] Remover bind específico de `data-resistor-select`.
- [x] Remover bind específico de `data-capacitor-select`.
- [x] Remover bind específico de `data-wifi-slider`.
- [x] Remover bind específico de `data-rain-active` e `data-rain-intensity`.
- [x] Remover bind específico de `data-light-enabled` e `data-light-intensity`.
- [x] Remover bind específico de `data-climate-*`.
- [x] Remover bind específico de `data-analog-*`.
- [x] Remover bind específico de `data-inspector-*` por componente.

### Estados visuais derivados

- [x] Criar descritores `visual.stateBindings` no manifest.
- [x] Permitir binding de classe CSS por sinal derivado.
- [x] Permitir binding de texto por sinal derivado.
- [x] Permitir binding por terminal, net, canal ambiental ou leitura elétrica.
- [x] Refatorar `applyRainSensorStates()` para usar state bindings.
- [x] Refatorar `applyLdrSensorStates()` para usar state bindings.
- [x] Refatorar `applyBmp280SensorStates()` para usar state bindings.
- [x] Refatorar `applyAdcStates()` para usar state bindings.
- [x] Garantir que novo sensor com leitura existente não precise de nova função `apply*States()`.

### Monitor de sinais

- [x] `renderSignals()` usa propriedades do componente selecionado.
- [x] `renderSignals()` usa terminais e conexões reais do projeto.
- [x] `renderSignals()` usa leituras elétricas por componente/net.
- [x] Remover heurística fixa `digitalPinFromTerminal()` baseada em regex `dN`.
- [x] Remover heurística fixa `analogPinFromTerminal()` baseada em `a0..a5`.
- [x] Remover heurística fixa `analogPinFromTerminal()` baseada em `ioN`.
- [x] Criar resolver compartilhado de pinos/capacidades.
- [x] Ler capacidades de pinos a partir do manifest do microcontrolador.
- [x] Suportar sinais nomeados por componente/net sem depender de campos legados.

## `apps/web/js/simulation/simulation-engine.js`

### Fontes ambientais

- [x] Refatorar `bindEnvironmentChannels()` para iterar componentes com `simulation.kind === "environment-source"`.
- [x] Criar canais ambientais por `behavior.channel`.
- [x] Ler propriedade principal por `behavior.valueProperty`.
- [x] Ler propriedade ativa por `behavior.activeProperty`.
- [x] Ler propriedade de intensidade por `behavior.intensityProperty`.
- [x] Normalizar payload ambiental por adapter/schema.
- [x] Remover criação hardcoded de canal `distance`.
- [x] Remover criação hardcoded de canal `rain`.
- [x] Remover criação hardcoded de canal `light`.
- [x] Remover criação hardcoded de canal `climate`.
- [x] Remover criação hardcoded de canal `analog-voltage`.

### Binders de sensores e conversores

- [x] Criar registry de behaviors da simulação.
- [x] Registrar behavior do HC-SR04 em vez de chamar diretamente `bindHcsr04Sensors()`.
- [x] Registrar behavior do FC-37 em vez de chamar diretamente `bindRainSensors()`.
- [x] Registrar behavior do LDR em vez de chamar diretamente `bindLightSensors()`.
- [x] Registrar behavior do BMP280 em vez de chamar diretamente `bindBmp280Sensors()`.
- [x] Registrar behavior dos ADS1015/ADS1115 em vez de lógica fixa em `bindAdcConverters()`.
- [x] Registrar behavior do MCP3008 em vez de lógica fixa em `bindAdcConverters()`.
- [x] Mover seleção de fonte ambiental para metadados do manifest.
- [x] Mover seleção de terminal/canal para metadados do manifest.
- [x] Permitir que behaviors especializados existam, mas isolados em adapters.

### Pinos e barramentos

- [x] Criar manifest de board com `pinMap` completo e capacidades.
- [x] Criar resolver para pinos digitais por capacidade, não por regex.
- [x] Criar resolver para pinos analógicos por capacidade, não por regex.
- [x] Criar resolver para buses I2C por capacidade.
- [x] Criar resolver para buses SPI por capacidade.
- [x] Remover busca fixa por `graph.findComponentsByType('arduino')[0]`.
- [x] Remover suposição de I2C Arduino em `A4/A5`.
- [x] Remover suposição de I2C ESP32 em `IO21/IO22`.
- [x] Remover suposição de SPI/CS do MCP3008 por pino digital Arduino.
- [x] Preparar capacidades para ESP32: I2C, SPI, PWM, ADC, timers e interrupções.

### Sinais legados

- [x] Criar `signalsByComponent`.
- [x] Criar `signalsByNet`.
- [x] Migrar UI para consumir sinais por componente selecionado.
- [x] Manter `trig`, `echo`, `led`, `rain`, `rainDo`, `light` e `lightAnalog` apenas como compatibilidade temporária.
- [x] Remover consumo direto dos sinais legados quando a UI estiver migrada.

## `apps/web/js/simulation/electrical-solver.js`

- [x] Resolver caminho série simples `GPIO HIGH -> resistor -> LED -> GND`.
- [x] Detectar LED sem resistor efetivo.
- [x] Detectar corrente excessiva no LED.
- [x] Detectar resistência excessiva para LED visível.
- [x] Detectar potência excedida no resistor.
- [x] Detectar curto básico entre saída HIGH e GND.
- [x] Evoluir solver para netlist por primitives do manifest.
- [x] Modelar `voltage-source` de forma genérica.
- [x] Modelar `resistor` de forma genérica fora do caso LED.
- [x] Modelar `diode-led` de forma genérica.
- [x] Modelar `sensor-module` com limites de tensão/corrente.
- [x] Modelar `capacitor` pelo menos para validação elétrica inicial.
- [x] Diagnosticar incompatibilidade de tensão lógica por terminal.
- [x] Diagnosticar sobrecorrente por módulo/sensor.
- [x] Diagnosticar tensão flutuante em entradas relevantes.
- [x] Emitir diagnósticos por componente, terminal e net.

## Firmware, Clang e WASM

### `apps/web/firmware/wasm-compiler.mjs`

- [x] Compilar firmware pelo caminho WASM.
- [x] Injetar shim mínimo Arduino/ESP32 para APIs já suportadas.
- [x] Suportar shims de Serial, WiFi, Wire, SPI, BMP280, ADS e MCP no caminho atual.
- [x] Criar registry de bibliotecas/shims.
- [x] Carregar shims conforme `#include` detectado.
- [x] Documentar APIs suportadas por biblioteca.
- [x] Evitar adicionar novas bibliotecas diretamente no compiler central.

### `apps/web/js/simulation/wasm-firmware-runner.js`

- [x] Mapear imports WASM para runtime Arduino básico.
- [x] Mapear imports WASM para Serial.
- [x] Mapear imports WASM para WiFi.
- [x] Mapear imports WASM para I2C/SPI inicial.
- [x] Separar imports por módulos/adapters.
- [x] Registrar adapters por biblioteca.
- [x] Registrar adapters por capability.
- [x] Manter runner como orquestrador, sem lógica específica de cada biblioteca.

### `apps/web/js/simulation/firmware-engine.js`

- [x] Documentar IR JS como depreciada.
- [x] Isolar IR JS para fallback/debug temporário.
- [x] Impedir novos componentes de dependerem da IR JS.
- [ ] Remover IR JS quando WASM cobrir os cenários necessários.

## Testes

- [x] Manter exemplos como testes de integração.
- [x] Validar arquivos JSON de componentes e exemplos.
- [x] Criar testes por contrato de manifest.
- [x] Testar renderização de propriedade genérica por `propertySchema`.
- [x] Testar bind genérico de propriedade inline.
- [x] Testar bind genérico de propriedade no inspector.
- [x] Testar registry de behaviors com componente fake.
- [x] Testar resolver de pinos/capacidades com board fake.
- [x] Testar que componente simples novo não exige alteração em `board-editor.js`.

## Ordem de execução sugerida

- [x] Etapa 1: inspector por schema de manifest.
- [x] Etapa 2: controles inline por schema e `visual.controls`.
- [x] Etapa 3: registry de behaviors na simulation engine.
- [x] Etapa 4: resolver de pinos/buses por manifest de microcontrolador.
- [x] Etapa 5: sinais por componente/net em vez de campos legados.
- [x] Etapa 6: registry de shims WASM por biblioteca.
- [x] Etapa 7: netlist elétrico mais genérico para passivos e módulos.

## Checklist para novos componentes oficiais

Checklist movido para `docs/official-component-guidelines.md`, que deve ser lido antes dos documentos em `add-components/`.

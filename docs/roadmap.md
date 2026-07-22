# Roadmap Técnico

## Concluído

### Fundação

- Schemas JSON de projeto e componente.
- Estrutura inicial em `apps/`, `packages/`, `components/`, `examples/`, `schemas/`, `docs/` e `tests/`.
- Testes com Node 24.
- Núcleo temporal determinístico.
- Runtime Arduino inicial.
- Ambiente com canais versionados.

### Editor Web

- UI web local em `apps/web`.
- Board com pan/zoom, drag-and-drop, terminais e fios.
- Paleta carregada via manifests oficiais.
- Inspector de propriedades e sinais.
- Painel inferior com Código, Console, Serial e Problemas.
- CodeMirror para Arduino/C++.
- Import/export JSON e persistência em `localStorage`.
- Undo/Redo em memória.

### Catálogo e Exemplos

- Componentes oficiais em `components/official`.
- Arduino UNO expandido com pinos digitais, analógicos e alimentação.
- Resistores com variantes.
- Capacitor com variantes.
- LEDs vermelho, verde e azul.
- HC-SR04 e controle ambiental de distância.
- ESP32 DevKitC V4 e controle ambiental Wi-Fi Signal.
- FC-37 Rain Sensor e controle ambiental Rain Environment.
- API `GET /api/components`.
- API `GET /api/examples` e `GET /api/examples/:id`.
- Exemplo HC-SR04 + LED carregado a partir de `examples/hc-sr04-led-distance/project.json`.
- Exemplos ESP32 counter blink, ESP32 Wi-Fi Signal e ESP32 Wi-Fi Failover.
- Exemplo FC-37 Rain Digital.

### Firmware e Simulação

- Firmware WASM como caminho único de execução na UI.
- Integração com Clang local para diagnósticos e compilação WASM.
- Dependência documentada de `clang++` e `wasm-ld`.
- `Serial.begin`, `print`, `println`, `write`, `available` e `read`.
- Separação visual de Serial TX/RX.
- HC-SR04 respondendo ao runtime.
- ESP32/Wi-Fi inicial por imports WASM, incluindo múltiplas redes e failover por RSSI/internet ativa.
- Solver incremental para caminho série LED/resistor.
- Diagnósticos de resistor ausente, sobrecorrente, potência excedida, resistência excessiva, tensão insuficiente e curtos básicos.

## Próximos Marcos

### Catálogo Extensível

- Validar consistência entre `terminals` e `visual.terminals` em todos os manifests.
- Definir contrato mínimo para componentes com comportamento simulado.
- Adicionar novos sensores, inputs, atuadores e microcontroladores.
- Generalizar o mapeamento de pinos por manifest de microcontrolador.

### Solver Elétrico

- Evoluir para análise nodal ou solver incremental mais geral.
- Diferenciar visualmente conexões ambientais de conexões elétricas.
- Modelar componentes passivos além de resistor/LED no cálculo.
- Melhorar mensagens de problema para múltiplas topologias.

### Firmware

- Ampliar cobertura do shim/imports WASM para novas APIs Arduino/ESP32.
- Remover ou rebaixar a IR JavaScript depreciada para ferramenta auxiliar/testes.
- Exibir diagnósticos inline no CodeMirror.
- Avaliar cache persistente/distribuído para builds WASM em deploy público.
- Reavaliar fallback WASM/browser após MVP público, se o custo de infraestrutura justificar.

### Desktop

- Integrar Electron.
- Definir processo main/preload/renderer.
- Salvar projetos no filesystem local.
- Preparar empacotamento desktop.

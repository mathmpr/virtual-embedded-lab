# Virtual Embedded Lab - TODO

Atualizado em 2026-07-21.

## Estado Atual

O projeto possui uma fundação testável e um protótipo web funcional. A aplicação ainda não é um simulador completo, mas já valida o fluxo visual do exemplo HC-SR04 + LED no navegador.

Para executar:

```bash
npm run dev
```

Para validar:

```bash
npm test
```

## Concluído

### Fundação do projeto

- [x] Repositório Git local inicializado.
- [x] `package.json` criado com scripts `dev`, `test` e `check`.
- [x] Estrutura inicial de monorepo criada em `apps/`, `packages/`, `components/`, `schemas/`, `examples/`, `docs/` e `tests/`.
- [x] Testes usando o runner nativo do Node 24 com `--experimental-transform-types`.
- [x] Documentação atualizada em `README.md`, `docs/architecture.md`, `docs/roadmap.md` e `docs/ui-decisions.md`.
- [x] Documento de requisitos original preservado em `docs/virtual-embedded-lab.md`.

### Schemas, catálogo e exemplos

- [x] `schemas/project.schema.json` criado.
- [x] `schemas/component.schema.json` criado.
- [x] Tipos TypeScript centrais criados em `packages/project-model/src/types.ts`.
- [x] `Project JSON` representa componentes, posições, propriedades, conexões elétricas, conexões ambientais, cores de fios e código.
- [x] Componentes oficiais são a fonte de verdade em `components/official/**/component.json`.
- [x] Frontend carrega o catálogo oficial via `GET /api/components`.
- [x] Exemplos são carregados de `examples/**/project.json` via `GET /api/examples` e `GET /api/examples/:id`.
- [x] Exemplo `examples/hc-sr04-led-distance/project.json` contém board, conexões, cores de fios e `main.ino`.
- [x] Exemplo `examples/esp32-counter-blink/project.json` valida firmware WASM com variável persistente, incremento e módulo `% 10`.
- [x] Exemplo `examples/esp32-wifi-failover/project.json` valida múltiplas redes Wi-Fi, RSSI por SSID e failover por internet ativa.

### Componentes oficiais atuais

- [x] Arduino UNO expandido com D0-D13, A0-A5, VIN, 3V3, 5V e GNDs.
- [x] Arduino UNO com LED built-in `L` associado ao D13/`LED_BUILTIN`.
- [x] Resistor com variantes de resistência.
- [x] Capacitor com variantes de capacitância.
- [x] LEDs vermelho, verde e azul em `Electronic/LEDs`.
- [x] HC-SR04.
- [x] Controle ambiental de distância.
- [x] Controle ambiental de Wi-Fi com SSID, internet ativa e força de sinal.
- [x] ESP32 DevKitC V4 com pinos oficiais dos headers J2/J3.
- [x] ESP32 DevKitC V4 com LED `PWR` e LED programável `LD` associado ao GPIO2.

### Núcleo de simulação

- [x] `VirtualClock`.
- [x] `EventScheduler` determinístico.
- [x] Agendamento por tempo absoluto e relativo.
- [x] Cancelamento de eventos.
- [x] Execução ordenada por tempo e ordem de inserção.
- [x] `EnvironmentEngine` com canais ambientais e snapshots.
- [x] `Hcsr04Behavior` integrado ao TRIG/ECHO.

### Runtime Arduino e firmware

- [x] `pinMode`, `digitalWrite`, `digitalRead` e `driveInput`.
- [x] `millis`, `micros`, `delay`, `delayMicroseconds` e `pulseIn`.
- [x] `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.write`, `Serial.available` e `Serial.read`.
- [x] Log Serial separando `TX` e `RX`.
- [x] Suporte inicial a `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.RSSI(ssid)` e `WiFi.internetAvailable`.
- [x] Suporte a blink clássico em LED built-in com execução contínua de `loop()` até Pause/Reset e timeline de `digitalWrite`.
- [x] Firmware engine por IR própria.
- [x] Clang integrado no servidor local para diagnósticos reais de sintaxe.
- [x] AST/IR derivada do Clang usada como frontend da firmware engine.
- [x] Endpoint experimental `POST /api/firmware/compile-wasm` para compilar firmware C/C++ freestanding em WASM no servidor.
- [x] Dependência local de `clang++` e `wasm-ld` documentada para execução de firmware WASM.
- [x] Firmware WASM instanciado no navegador/Node com imports conectados ao `ArduinoRuntime` para `pinMode`, `digitalRead`, `digitalWrite`, `delay`, `delayMicroseconds`, `pulseIn`, tempo, Serial e Wi-Fi com múltiplas redes.
- [x] Sessão WASM persistente entre frames de Run, preservando variáveis globais C/C++ como `counter`.
- [x] Firmware WASM exporta constantes de pinos e já executa o exemplo HC-SR04 com `pulseIn` ligado ao controle de distância.
- [x] Interface web usa WASM como único caminho de execução de firmware; falha de compilação WASM bloqueia a simulação em vez de cair para IR.
- [x] Exemplo ESP32 + Wi-Fi Signal compila e executa pelo caminho WASM.
- [x] Exemplo ESP32 + múltiplas redes Wi-Fi escolhe a rede mais forte com internet ativa pelo caminho WASM.

### Solver elétrico incremental

- [x] Caminho série simples `GPIO HIGH -> resistor -> LED -> GND`.
- [x] Corrente do LED.
- [x] Queda de tensão.
- [x] Potência no resistor.
- [x] Brilho aproximado.
- [x] LED sem resistor efetivo.
- [x] Sobrecorrente.
- [x] Potência excedida.
- [x] Resistência excessiva com corrente abaixo do mínimo visível.
- [x] Tensão insuficiente.
- [x] Curto 5V/GND simples.
- [x] Retorno do LED por qualquer terminal `ground`, incluindo múltiplos GNDs do Arduino.
- [x] Leituras elétricas exibidas no inspector.

### Interface web

- [x] App web estático em `apps/web`.
- [x] Servidor local Node em `apps/web/server.mjs`.
- [x] Tema inspirado em Darcula/JetBrains/IntelliJ/PhpStorm.
- [x] Topbar simplificada com botão funcional `Exemplos`.
- [x] Modal de exemplos carregado por API.
- [x] Paleta renderizada a partir dos manifests oficiais.
- [x] Board com pan/zoom.
- [x] Componentes por clique ou drag-and-drop.
- [x] Componentes móveis no board.
- [x] Terminais visuais clicáveis e circulares.
- [x] Fios SVG entre terminais.
- [x] Fios coloridos por `Project JSON` ou inferência por tipo de conexão.
- [x] Roteamento ortogonal com seleção de rota por pontuação.
- [x] Remoção visual de fios e componentes.
- [x] Undo/Redo em memória.
- [x] Salvar/carregar via `localStorage`.
- [x] Import/export JSON.
- [x] Slider de distância funcional sem mover o componente.
- [x] Inspector com propriedades e sinais contextuais.
- [x] Painel inferior com Código, Console, Serial e Problemas.
- [x] CodeMirror com sintaxe C++/Arduino e tema escuro.
- [x] Serial TX/RX com baud rate, histórico append-only limitado a 1000 eventos, toggle de auto-scroll e botão `Clear` fixos fora da área rolável de logs.

### Testes

- [x] Testes de JSON para schemas, manifests e exemplo.
- [x] Testes de scheduler determinístico.
- [x] Testes de solver LED/resistor.
- [x] Testes de comportamento HC-SR04.
- [x] Testes de firmware engine.
- [x] Testes do adaptador Clang.
- [x] Testes estáticos da UI para regiões principais, componentes, interações e regressões.

## Pendente

### Limitações atuais

- [ ] Desenvolvimento local ainda depende de `clang++`/`wasm-ld` instalados ou `CLANGXX`; deploy público deve usar sandbox/container.
- [ ] O solver elétrico ainda não é nodal/SPICE geral.
- [ ] Conexão ambiental ainda usa aparência de fio comum.
- [ ] Validação de tipos de terminal ainda é parcial.
- [ ] Undo/Redo existe apenas durante a sessão atual.
- [ ] O monitor de sinais ainda não renderiza waveform temporal real.
- [ ] Não há seleção múltipla.
- [ ] Não há snap-to-grid.
- [ ] Não há Electron integrado.

## Prioridades

### Prioridade 1 - Conectar UI ao modelo de projeto

- [x] Converter estado do board para `Project JSON`.
- [x] Salvar projeto em `localStorage`.
- [x] Carregar projeto salvo.
- [x] Exportar/importar `.json`.
- [x] Separar conexões elétricas de conexões ambientais.
- [x] Preservar cores de fios.

### Prioridade 2 - Nets reais no editor

- [x] Criar modelo de net no frontend.
- [x] Permitir múltiplos terminais na mesma net.
- [x] Mesclar nets quando fios unem redes existentes.
- [x] Remover fio sem quebrar conexões restantes indevidamente.
- [x] Mostrar net selecionada no inspector.
- [x] Validar terminais incompatíveis.

### Prioridade 3 - Integrar núcleo de simulação com a UI

- [x] Montar grafo de circuito a partir do board.
- [x] Ligar board visual ao `EnvironmentEngine`.
- [x] Ligar HC-SR04 visual ao `Hcsr04Behavior`.
- [x] Ligar pinos Arduino visuais ao `ArduinoRuntime`.
- [x] Substituir regras visuais hardcoded por execução no kernel web.
- [x] Atualizar console, sinais e problemas a partir do resultado do kernel.

### Prioridade 4 - Solver elétrico incremental

- [x] Resolver caminho série simples diretamente das nets.
- [x] Calcular corrente por LED real presente no board.
- [x] Detectar LED sem resistor por topologia.
- [x] Detectar resistor inadequado por valor/potência.
- [x] Detectar resistência excessiva.
- [x] Detectar tensão insuficiente e sobrecorrente.
- [x] Detectar curto 5V/GND simples.

### Prioridade 5 - Editor de código

- [x] Trocar `textarea` por CodeMirror.
- [x] Destacar sintaxe Arduino/C++.
- [x] Mostrar diagnósticos no painel de problemas.
- [ ] Mostrar diagnósticos inline no CodeMirror.

### Prioridade 6 - Firmware engine e Clang

- [x] Implementar IR inicial.
- [x] Suportar `setup`, `loop`, constantes, variáveis, `if`, chamadas Arduino e delays.
- [x] Mapear chamadas para o `ArduinoRuntime`.
- [x] Integrar Clang no backend.
- [x] Usar AST/IR derivada do Clang como frontend real da firmware engine.
- [x] Isolar a IR JS depreciada da arquitetura interna de execução em `legacy-ir-simulation.js`.
- [x] Ampliar imports WASM para Serial básico/RX e Wi-Fi com múltiplas redes.
- [x] Passar metadados de pinos/constantes e bindings de sensores para o runtime WASM no caso HC-SR04.
- [x] Isolar compilação WASM em sandbox/container para uso público.
- [x] Cachear builds por hash do código.
- [x] Avaliar fallback WASM/browser e adiar para pós-MVP público.

### Prioridade 7 - Expansão de catálogo e componentes

- [x] Definir contrato mínimo de componente oficial para novos sensores, atuadores e microcontroladores.
- [x] Separar componentes puramente visuais/passivos de componentes com comportamento simulado.
- [x] Adicionar `electricalModel` e `behavior` obrigatórios quando o componente impactar a simulação.
- [x] Criar testes de catálogo para garantir que todo componente com `visual.palette` aparece na UI.
- [x] Criar teste de consistência entre `visual.terminals` e `terminals` do manifest.
- [ ] Adicionar suporte a múltiplos microcontroladores no grafo.
- [ ] Generalizar mapeamento de pinos digitais/analógicos por manifest do microcontrolador.
- [ ] Adicionar Arduino Nano.
- [x] Adicionar ESP32 DevKit.
- [x] Adicionar componente ambiental Wi-Fi Signal.
- [x] Adicionar exemplo ESP32 + Wi-Fi Signal.
- [x] Adicionar exemplo ESP32 + Wi-Fi Failover.
- [x] Adicionar FC-37 Rain Sensor com leitura digital por WASM.
- [x] Adicionar Rain Environment com toggle ON/OFF.
- [x] Adicionar exemplo FC-37 Rain Digital.
- [ ] Adicionar DHT11/DHT22.
- [ ] Adicionar LDR/fotorresistor.
- [ ] Adicionar potenciômetro.
- [ ] Adicionar botão/push button.
- [ ] Adicionar buzzer.
- [ ] Adicionar servo motor.
- [ ] Adicionar display LCD 16x2/I2C.

### Prioridade 8 - Desktop

- [ ] Integrar Electron.
- [ ] Definir processo main/preload/renderer.
- [ ] Salvar projetos no filesystem local.
- [ ] Empacotar build desktop.

## Critérios Para Considerar o MVP Fechado

- [ ] Usuário monta o circuito do exemplo manualmente.
- [x] Usuário salva e reabre o projeto.
- [x] Código Arduino de referência é executado pelo runtime.
- [x] HC-SR04 responde ao pulso real do runtime.
- [x] `pulseIn` mede o pulso real do ECHO.
- [x] LED acende/apaga por efeito do código e do solver elétrico.
- [x] Solver calcula corrente/potência a partir das conexões reais para circuito série simples.
- [ ] Problemas elétricos aparecem de forma compreensível.
- [ ] Execuções iguais produzem resultados iguais.

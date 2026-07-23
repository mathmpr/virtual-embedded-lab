# Arquitetura

O Virtual Embedded Lab está organizado em camadas para manter o protótipo visual separado do modelo de projeto, do runtime Arduino e dos mecanismos de simulação.

## Camadas Principais

- `components/official/**/component.json`: fonte de verdade dos componentes oficiais, incluindo identidade, propriedades, variantes, terminais, modelo elétrico, comportamento e metadados visuais.
- `components/official/**/ui/styles.css`: estilos visuais específicos carregados via `contributions.styles`.
- `components/official/**/simulation/behavior.js`: behaviors especializados registrados via `contributions.simulationBehaviors`.
- `components/official/**/firmware/`: bibliotecas, shims C++ e imports WASM específicos do componente.
- `docs/component-contract.md`: contrato mínimo para manifests oficiais, incluindo `simulation.kind`, efeitos simulados, requisitos de `electricalModel`/`behavior` e invariantes de catálogo.
- `docs/component-description.md`: guia prático de como um componente é descrito e empacotado.
- `examples/**/project.json`: projetos de exemplo completos, incluindo board, componentes, conexões, cores de fios e código.
- `schemas/`: contratos JSON de projeto e componentes.
- `packages/`: núcleos reutilizáveis e tipos iniciais.
- `apps/web/server.mjs`: servidor local da UI e APIs de apoio.
- `apps/web/js/`: renderer web, board visual, catálogo, serialização, simulação e integração com CodeMirror.
- `apps/web/firmware/clang-analyzer.mjs`: adaptador Node para diagnósticos e AST/IR legada via Clang.
- `apps/web/firmware/wasm-compiler.mjs`: compilador freestanding que gera firmware WASM com `clang++` e `wasm-ld`.

## Servidor Local

O servidor Node expõe:

- `GET /api/components`: lê todos os manifests em `components/official`.
- `GET /api/examples`: lista exemplos disponíveis.
- `GET /api/examples/:id`: retorna o `project.json` completo de um exemplo.
- `POST /api/firmware/analyze`: executa Clang quando disponível e retorna diagnósticos e IR.
- `POST /api/firmware/compile-wasm`: endpoint experimental que compila firmware C/C++ freestanding para WebAssembly quando `clang++` e `lld/wasm-ld` estão disponíveis.
- `POST /api/network/mqtt/*`: bridge Node para broker MQTT TCP real quando o projeto declara `network.mqtt.mode` como `"real"`.

Essa decisão mantém o frontend simples e permite que novos componentes/exemplos sejam adicionados por arquivo, sem editar código da UI.

Os arquivos em `/components/official/**` também são servidos estaticamente. Isso permite que manifests apontem para CSS, behaviors e imports WASM dentro da própria pasta do componente.

## Firmware

A UI executa firmware pelo caminho WASM. A IR JavaScript ainda existe como infraestrutura legada/testes e como referência de análise, mas está depreciada como caminho de execução de firmware e não é fallback visual. A dependência de execução por IR fica isolada em `apps/web/js/simulation/legacy-ir-simulation.js`; `simulation-engine.js` não importa `firmware-engine.js`.

O Clang ainda é usado como frontend de diagnóstico no fluxo local:

- o servidor chama `clang++ -fsyntax-only -Xclang -ast-dump=json`;
- um shim mínimo de Arduino fornece símbolos como `Serial`, `pinMode`, `digitalWrite` e `pulseIn`;
- o shim também expõe símbolos iniciais de ESP32/Wi-Fi, como `WiFi`, `WIFI_STA`, `WIFI_AP` e `WL_CONNECTED`;
- o backend converte a AST JSON para a IR suportada pela firmware engine legada.

Limite atual: a IR JS não deve ser expandida com novas features de firmware. Novas APIs devem ser implementadas no shim/imports WASM.

## Firmware WASM Experimental

O servidor possui um compilador freestanding que chama `clang++ --target=wasm32` com `-nostdlib`, usa `wasm-ld` via toolchain `lld` e exporta `__vl_setup`, `__vl_loop` e `memory`.

O shim C++ transforma APIs Arduino mínimas em imports controlados pelo simulador, como:

- `pinMode`;
- `digitalRead`;
- `digitalWrite`;
- `delay`;
- `delayMicroseconds`;
- `millis`;
- `micros`;
- `pulseIn`;
- `Serial.print`;
- `Serial.println`;
- `Serial.available`;
- `Serial.read`;
- `WiFi.mode`;
- `WiFi.begin`;
- `WiFi.status`;
- `WiFi.softAP`;
- `WiFi.scanNetworks`;
- `WiFi.RSSI`;
- `WiFi.RSSI(ssid)`;
- `WiFi.internetAvailable`.

O frontend instancia o WASM e conecta esses imports ao `ArduinoRuntime`. Imports Arduino/core ficam em `apps/web/js/simulation/wasm-import-adapters.js`; imports específicos de bibliotecas ficam nos componentes e são registrados via `contributions.wasmImports`. A instância WASM é mantida viva durante o Run, preservando globais C/C++ entre frames de simulação. A UI usa WASM como caminho único de execução de firmware: quando a compilação WASM falha, a simulação é bloqueada e os diagnósticos do `clang-wasm` são exibidos, sem fallback para IR.

O compilador WASM exporta constantes de firmware, como `TRIGGER_PIN`, `ECHO_PIN`, `LED_PIN`, `PIN` e `LED_BUILTIN`, para que o runtime consiga mapear sensores e LEDs sem depender da IR. Com isso, os exemplos HC-SR04, blink/counter, Serial, ESP32/ESP8266 Wi-Fi/MQTT/HTTP, sensores I2C/SPI e bomba d'água rodam pelo caminho WASM.

Projetos multi-board usam `project.firmwares` para mapear um firmware por microcontrolador. A UI mantém um seletor de firmware no editor, compila cada sketch separadamente e cria uma sessão WASM por placa. O runtime compartilha relógio virtual, scheduler, grafo de conexões, ambiente e rede declarada, mas mantém GPIO, Serial, Wi-Fi e MQTT isolados por componente.

Para uso público, a compilação WASM deve rodar isolada em container. O compilador aceita `WASM_COMPILER_SANDBOX=docker` ou `WASM_COMPILER_SANDBOX=podman`, monta apenas o diretório temporário da build em `/workspace`, desabilita rede e aplica limites de CPU, memória e processos. Em desenvolvimento local, o padrão continua sendo executar `clang++` diretamente no host.

Builds WASM bem-sucedidos são cacheados em memória por hash do código gerado, constantes exportadas, comando do Clang e configuração de sandbox/toolchain. Esse cache reduz recompilações idênticas sem persistir binários entre reinícios do servidor.

Fallback de compilação no browser foi avaliado e fica fora do MVP público. A decisão atual é manter um único caminho de execução por WASM compilado no servidor, preferencialmente isolado por container, porque embarcar toolchain C/C++ no browser aumentaria muito o peso, a complexidade de cache e a superfície de incompatibilidade.

## Componentes e Contribuições

Componentes oficiais seguem um modelo de pacote. O manifest descreve o contrato declarativo; arquivos opcionais dentro da pasta do componente adicionam comportamento específico.

Princípios:

- o core orquestra catálogo, board, runtime, solver, ambiente e firmware;
- o componente declara dados, visual, propriedades, terminais, modelo elétrico e behavior;
- CSS específico fica em `components/official/<slug>/ui/styles.css`;
- libraries de firmware específicas ficam em `components/official/<slug>/firmware/library*.json`;
- shims específicos ficam em `components/official/<slug>/firmware/shims/*.cpp`;
- imports WASM específicos ficam em `components/official/<slug>/firmware/wasm-imports.js`;
- behaviors específicos ficam em `components/official/<slug>/simulation/behavior.js`.

O carregador de componentes instala manifests oficiais, injeta CSS declarado em `contributions.styles`, registra behaviors declarados em `contributions.simulationBehaviors` e registra imports WASM declarados em `contributions.wasmImports`.

O arquivo `apps/web/firmware/core-libraries.json` contém apenas bibliotecas core compartilhadas: Arduino core, Serial, Wire e SPI. Bibliotecas como Wi-Fi, MQTT, DHT, Servo, LCD, BMP280 e ADCs externos ficam nas pastas dos respectivos componentes.

Editar arquivos core deve ser exceção para adicionar capacidade genérica nova. Adicionar um sensor, display, atuador ou biblioteca específica deve ser majoritariamente append-only dentro de `components/official/<slug>/`.

## Simulação

O kernel web monta um grafo a partir do board e das nets derivadas dos fios.

Escopo atual:

- `VirtualClock` e `EventScheduler` determinísticos.
- `ArduinoRuntime` com GPIO, tempo virtual, delays, `pulseIn` e Serial TX/RX.
- Suporte inicial a `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.RSSI(ssid)` e `WiFi.internetAvailable`, alimentado por componentes ambientais Wi-Fi standalone.
- `WiFiClient` com TCP/HTTP virtual delegado para `virtual-http-server.js`, incluindo rotas padrão e rotas declaradas por projeto.
- `AsyncMqttClient` com broker MQTT virtual delegado para `virtual-mqtt-broker.js` ou broker MQTT real delegado ao backend Node por `network/mqtt-bridge.mjs`.
- Sistemas ambientais/hidráulicos simplificados por adapters, incluindo SSR, bomba d'água e reservatório.
- `EnvironmentEngine` para canais ambientais.
- `Hcsr04Behavior` integrado ao TRIG/ECHO.
- Solver elétrico incremental para LED/resistor e curtos básicos.

Behaviors especializados devem ser registrados por componentes quando possível. Adapters core permanecem apenas para capacidades genéricas ou legado ainda não extraído.

Limite atual: o solver ainda não é nodal/SPICE geral. Ele cobre o caminho necessário para o MVP e expõe leituras úteis ao inspector.

## Modelo de Projeto

O `Project JSON` contém:

- componentes e posições;
- conexões elétricas como nets;
- conexões ambientais separadas;
- rede virtual opcional em `network.http`, com hosts e rotas HTTP declarativas;
- rede MQTT opcional em `network.mqtt`, virtual por padrão ou real quando `mode` é `"real"`;
- cores de fios por conexão;
- código Arduino em `code.files`;
- firmwares por placa em `firmwares`, usado por projetos multi-board;
- metadados básicos do board.

A UI consegue salvar em `localStorage`, carregar, importar e exportar esse formato.

## Exemplos com Serviços Externos

A maior parte dos exemplos é autossuficiente e usa ambiente, HTTP ou MQTT virtuais. Exceções devem documentar explicitamente suas dependências no próprio firmware e na documentação.

O exemplo `examples/esp-water-control-pump-reservoir/project.json` replica um cenário real de caixa d'água e depende do contrato MQTT/backend do projeto externo `https://github.com/mathmpr/water-control` quando executado em modo MQTT real. Nesse cenário:

- o ESP32 sender publica sensores em tópicos como `detect/water` e `income/water`;
- o ESP8266 asker assina `toggle/water` e aciona o SSR;
- o SSR liga/desliga a bomba, e a bomba altera o reservatório;
- o backend externo decide o estado da bomba a partir de tokens/payloads reais.

Essa dependência é do exemplo, não do core do Virtual Embedded Lab.

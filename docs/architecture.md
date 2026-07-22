# Arquitetura

O Virtual Embedded Lab está organizado em camadas para manter o protótipo visual separado do modelo de projeto, do runtime Arduino e dos mecanismos de simulação.

## Camadas Principais

- `components/official/**/component.json`: fonte de verdade dos componentes oficiais, incluindo identidade, propriedades, variantes, terminais, modelo elétrico, comportamento e metadados visuais.
- `docs/component-contract.md`: contrato mínimo para manifests oficiais, incluindo `simulation.kind`, efeitos simulados, requisitos de `electricalModel`/`behavior` e invariantes de catálogo.
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

Essa decisão mantém o frontend simples e permite que novos componentes/exemplos sejam adicionados por arquivo, sem editar código da UI.

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

O frontend instancia o WASM e conecta esses imports ao `ArduinoRuntime`. A instância WASM é mantida viva durante o Run, preservando globais C/C++ entre frames de simulação. A UI usa WASM como caminho único de execução de firmware: quando a compilação WASM falha, a simulação é bloqueada e os diagnósticos do `clang-wasm` são exibidos, sem fallback para IR.

O compilador WASM exporta constantes de firmware, como `TRIGGER_PIN`, `ECHO_PIN`, `LED_PIN`, `PIN` e `LED_BUILTIN`, para que o runtime consiga mapear sensores e LEDs sem depender da IR. Com isso, os exemplos HC-SR04, ESP32 counter blink, ESP32 Wi-Fi Signal e ESP32 Wi-Fi Failover rodam pelo caminho WASM.

Para uso público, a compilação WASM deve rodar isolada em container. O compilador aceita `WASM_COMPILER_SANDBOX=docker` ou `WASM_COMPILER_SANDBOX=podman`, monta apenas o diretório temporário da build em `/workspace`, desabilita rede e aplica limites de CPU, memória e processos. Em desenvolvimento local, o padrão continua sendo executar `clang++` diretamente no host.

Builds WASM bem-sucedidos são cacheados em memória por hash do código gerado, constantes exportadas, comando do Clang e configuração de sandbox/toolchain. Esse cache reduz recompilações idênticas sem persistir binários entre reinícios do servidor.

Fallback de compilação no browser foi avaliado e fica fora do MVP público. A decisão atual é manter um único caminho de execução por WASM compilado no servidor, preferencialmente isolado por container, porque embarcar toolchain C/C++ no browser aumentaria muito o peso, a complexidade de cache e a superfície de incompatibilidade.

## Simulação

O kernel web monta um grafo a partir do board e das nets derivadas dos fios.

Escopo atual:

- `VirtualClock` e `EventScheduler` determinísticos.
- `ArduinoRuntime` com GPIO, tempo virtual, delays, `pulseIn` e Serial TX/RX.
- Suporte inicial a `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.RSSI(ssid)` e `WiFi.internetAvailable`, alimentado por componentes ambientais Wi-Fi standalone.
- `EnvironmentEngine` para canais ambientais.
- `Hcsr04Behavior` integrado ao TRIG/ECHO.
- Solver elétrico incremental para LED/resistor e curtos básicos.

Limite atual: o solver ainda não é nodal/SPICE geral. Ele cobre o caminho necessário para o MVP e expõe leituras úteis ao inspector.

## Modelo de Projeto

O `Project JSON` contém:

- componentes e posições;
- conexões elétricas como nets;
- conexões ambientais separadas;
- cores de fios por conexão;
- código Arduino em `code.files`;
- metadados básicos do board.

A UI consegue salvar em `localStorage`, carregar, importar e exportar esse formato.

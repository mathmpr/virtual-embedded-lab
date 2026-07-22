# Decisões de UI

Este documento registra as decisões atuais da interface web do Virtual Embedded Lab.

## Direção Visual

A UI segue uma linguagem inspirada em Darcula/JetBrains/IntelliJ/PhpStorm:

- fundo escuro;
- painéis com divisórias fortes;
- topbar de IDE;
- tool windows laterais;
- board central;
- painel inferior com abas;
- tipografia monoespaçada para código, sinais e valores técnicos;
- acentos em azul para seleção/sinais e verde para execução.

O objetivo é parecer uma ferramenta técnica local-first, não um dashboard genérico.

## Layout

A tela principal é dividida em:

- topbar com botão funcional `Exemplos` e controles de simulação;
- paleta categorizada de componentes à esquerda;
- board visual no centro;
- inspector de propriedades e sinais contextuais à direita;
- painel inferior com Código, Console, Serial e Problemas.

O painel inferior é redimensionável verticalmente por `--bottom-panel-height`. As abas do painel inferior trocam a view principal: a aba ativa ocupa a área larga e as demais ficam empilhadas na coluna lateral.

O inspector possui um único scroll vertical. As propriedades e o monitor de sinais ficam no mesmo fluxo para manter o contexto do componente selecionado.

## Catálogo de Componentes

A fonte de verdade dos componentes oficiais fica em `components/official/**/component.json`.

O backend expõe `GET /api/components`, lendo todos os manifests oficiais e retornando o catálogo para o frontend. O módulo `js/components.js` não declara componentes manualmente; ele normaliza os manifests recebidos em:

- definições visuais;
- mapas de serialização;
- propriedades default;
- variantes;
- itens da paleta.

A paleta possui scroll vertical próprio e cards compactos. Os componentes são agrupados por categorias como `Boards`, `Sensors`, `Inputs` e `Electronic`, com subcategorias como `ESP32`, `Wireless`, `Resistors`, `LEDs` e `Capacitors`.

## Exemplos

Exemplos ficam em `examples/**/project.json`.

A topbar possui apenas a ação `Exemplos`, que abre um modal. O modal chama:

- `GET /api/examples` para listar projetos disponíveis;
- `GET /api/examples/:id` para carregar o projeto completo.

Ao selecionar um exemplo, a UI restaura board, conexões, cores de fios e código no CodeMirror. O exemplo default também é carregado pelo JSON real, não por montagem hardcoded no frontend.

## Componentes Editáveis

Resistores possuem variantes declaradas em `variants.resistanceOhms`. Cada variante possui `value` numérico em ohms e `label` legível usando `Ω`, como `220 Ω`, `1 kΩ` e `10 kΩ`.

Capacitores usam `variants.capacitanceMicrofarads`. O `value` fica normalizado em microfarads e o `label` pode usar unidades mais legíveis, como `100 nF`, `10 µF` e `4700 µF`.

Resistência, capacitância, distância e sinal Wi-Fi podem ser editados pelo componente no board ou pelo inspector. O controle Wi-Fi expõe SSID, internet ativa e força de sinal de 0 a 100%. Ele é standalone: não possui terminais e não precisa ser conectado por fio ao ESP32.

LEDs vermelho, verde e azul ficam em `Electronic/LEDs`. Cada LED possui tipo visual próprio, mas todos compartilham `electricalModel.primitive = led`, permitindo reutilizar a mesma regra elétrica.

O ESP32 DevKitC V4 fica em `Boards/ESP32` e seu manifesto declara os pinos dos headers J2/J3 com base na documentação oficial da Espressif. D0, D1, D2, D3, CMD e CLK são mantidos no catálogo, mas marcados como reservados para SPI flash no comportamento do componente.

O Arduino UNO possui indicador built-in `L` associado ao D13/`LED_BUILTIN`. O ESP32 DevKitC V4 possui `PWR` sempre ligado e `LD` programável associado ao GPIO2/`LED_BUILTIN`, mapeamento comum em placas ESP32 DevKit. O valor de `LED_BUILTIN` é resolvido pelo manifest do microcontrolador presente no projeto.

Para tornar o exemplo clássico de blink observável, o Run mantém a simulação ativa até Pause/Reset. Cada frame executa iterações de `loop()`, respeita `delay()` no tempo virtual e registra eventos temporais de `digitalWrite`. A UI usa essa timeline para animar LEDs built-in em escala curta, preservando o estado final do pino ao término de cada frame. Quando o usuário usa `LED_PIN` ou `PIN` sem declarar o constante, o firmware assume esse nome como alias de `LED_BUILTIN` do board atual.

## Board

O board usa uma viewport visual com `overflow: hidden` e uma superfície interna maior.

Decisões atuais:

- `#board` é a janela visível;
- `#boardViewport` é a superfície transformável;
- componentes são HTML posicionados em `#componentLayer`;
- fios são SVG em `#wireLayer`;
- pan usa barra de espaço + arraste;
- zoom usa scroll do mouse preservando o ponto sob o cursor;
- carregar exemplo/projeto centraliza o conteúdo na área visível.

HTML facilita inputs, hover, foco e inspector. SVG facilita fios, hit testing, seleção e remoção.

## Terminais e Fios

Terminais são botões HTML circulares com tipo visual:

- `power`;
- `ground`;
- `signal`;
- `environment`.

Fluxo de criação:

1. Usuário clica em um terminal.
2. O terminal fica pendente.
3. Usuário clica em outro terminal.
4. Um fio SVG é criado entre eles.

Fios podem receber `color` no `Project JSON`. Quando não há cor explícita, a UI infere:

- vermelho para `power`;
- branco para `ground`;
- verde para ambiente;
- azul para sinais.

O desenho usa segmentos ortogonais e escolhe a melhor rota entre candidatas Manhattan. A pontuação considera comprimento, quantidade de dobras, proximidade de cards e cruzamento com componentes. Isso evita a antiga saída fixa por lado do terminal e reduz fios escondidos atrás dos componentes.

## Nets

O editor possui nets derivadas dos fios existentes.

Decisões atuais:

- fios continuam existindo para renderização, remoção e Undo/Redo;
- Union-Find agrupa terminais conectados;
- exportação grava nets elétricas em `connections`;
- conexões ambientais são gravadas em `environmentConnections`;
- clicar em um fio seleciona a net correspondente no inspector;
- remover um fio recalcula as nets a partir dos fios restantes.

Validações atuais:

- bloqueia curto direto entre `power` e `ground`;
- permite `ENV` apenas ligado a terminal de sinal/comportamento;
- ainda não valida todos os conflitos elétricos possíveis.

## Editor de Código

O editor usa CodeMirror 6 com:

- `@codemirror/lang-cpp`;
- `@codemirror/theme-one-dark`;
- import map local apontando para `node_modules`;
- wrapper simples em `js/code-editor.js`.

Ao executar a simulação, a UI chama `POST /api/firmware/analyze` para diagnósticos e `POST /api/firmware/compile-wasm` para gerar o firmware executável. O painel Problemas exibe diagnósticos de Clang, `clang-wasm`, runtime e solver.

Limite atual: ainda não há markers inline no CodeMirror.

## Simulação Visual

O arquivo `js/visual-simulation.js` é um adaptador fino entre UI e kernel web.

Hoje:

- o board é convertido em grafo de circuito;
- nets alimentam conectividade;
- controles ambientais criam canais no `EnvironmentEngine`;
- sensores HC-SR04 são ligados a `Hcsr04Behavior`;
- pinos Arduino são manipulados por `ArduinoRuntime`;
- firmware é executado por WASM compilado via `clang++`/`wasm-ld`;
- resultados atualizam LED, sinais, Serial, Console e Problemas.

A simulação deixou de depender de regras visuais hardcoded no exemplo e não usa fallback visual para IR. Se o firmware WASM não compila, a execução é bloqueada com diagnóstico.

## Solver Elétrico

O solver atual cobre caminho série simples:

`GPIO HIGH -> resistor -> LED anodo -> LED catodo -> GND`

Ele calcula:

- corrente do LED;
- queda de tensão;
- potência do resistor;
- brilho aproximado;
- estado visual do LED.

Também diagnostica:

- LED sem resistor efetivo;
- sobrecorrente;
- potência excedida no resistor;
- resistência excessiva que deixa corrente abaixo do mínimo visível;
- tensão insuficiente;
- curto 5V/GND;
- saída HIGH ligada ao GND.

O estado visual do LED é baseado na corrente calculada, não apenas na existência de conexão.

Limite atual: ainda não é um solver nodal/SPICE geral.

## Serial

O runtime Arduino possui Serial integrada ao tempo virtual:

- `Serial.begin`;
- `Serial.print`;
- `Serial.println`;
- `Serial.write`;
- `Serial.available`;
- `Serial.read`.

O painel Serial separa `TX` e `RX`, mostra baud rate e tempo virtual, mantém histórico append-only limitado aos últimos 1000 eventos e possui botão `Clear`. `Auto-scroll` e `Clear` ficam juntos em uma barra fixa no rodapé do card Serial, fora da área rolável de logs.

Limite atual: Serial ainda é buffer textual simples. Não há temporização por bit, framing UART, paridade, stop bits ou componente físico RX/TX.

## Wi-Fi

O componente ambiental Wi-Fi Signal representa uma rede sem fio no cenário. O projeto pode ter múltiplos Wi-Fi Signal simultâneos, cada um com SSID, checkbox de internet ativa e slider de força de sinal.

O runtime interpreta chamadas ESP32/Arduino Core iniciais:

- `WiFi.mode`;
- `WiFi.begin`;
- `WiFi.status`;
- `WiFi.softAP`;
- `WiFi.scanNetworks`.
- `WiFi.RSSI`.
- `WiFi.RSSI(ssid)`;
- `WiFi.internetAvailable`.

No modo station, `WiFi.begin` conecta quando algum Wi-Fi Signal possui força maior que zero e o SSID corresponde ao ambiente. `WiFi.RSSI(ssid)` permite comparar redes antes de conectar. O checkbox de internet ativa não altera RSSI nem associação ao access point; ele representa se a rede conectada teria saída para internet e é lido por `WiFi.internetAvailable()`. No modo access point, `WiFi.softAP` registra o AP virtual no snapshot do runtime.

Rede atual: `WiFiClient` expõe um modelo TCP/HTTP virtual suficiente para requests textuais e rotas declaradas no projeto; `AsyncMqttClient` pode usar broker virtual ou broker MQTT real via bridge backend Node. Ainda não há pilha TCP/IP completa, DNS real, TLS/HTTPS criptográfico, autenticação MQTT, QoS completo ou sockets arbitrários no browser/WASM.

## Monitor de Sinais

O monitor de sinais fica no inspector e depende do componente selecionado:

- Arduino mostra cards de Ultrassom e LED;
- HC-SR04 mostra TRIG/ECHO;
- LED mostra ON/OFF;
- Wi-Fi Signal mostra internet ativa e força de sinal;
- outros componentes mostram mensagem de ausência de sinais monitoráveis.

O painel inferior não possui aba de sinais para evitar misturar sinais globais com propriedades locais.

## Persistência

A UI possui:

- salvar em `localStorage`;
- carregar do `localStorage`;
- exportar `.json`;
- importar `.json`;
- Undo/Redo em memória.

O `Project JSON` preserva componentes, posições, propriedades, conexões, cores de fios e código.

## Limitações Conhecidas

- Conexão ambiental ainda usa aparência de fio comum.
- Nets ainda não são editadas como entidade própria.
- Validação elétrica ainda é parcial.
- Não há seleção múltipla.
- Não há snap-to-grid.
- Undo/Redo não persiste entre sessões.
- Não há Electron integrado.
- Não há waveform temporal real no monitor de sinais.

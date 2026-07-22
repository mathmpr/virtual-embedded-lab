# Virtual Embedded Lab

Ambiente visual local-first para criação, programação e simulação comportamental de projetos eletrônicos embarcados.

O projeto já possui um protótipo web funcional com board visual, catálogo oficial de componentes, editor CodeMirror, runtime Arduino inicial, análise de firmware com Clang local, Serial TX/RX, Wi-Fi simulado para ESP32, solver elétrico incremental e exemplo completo HC-SR04 + LED.

## Requirements

Obrigatórios:

- Node.js 24 ou superior.
- Dependências do projeto instaladas com `npm install`.
- `clang++` disponível no `PATH`, ou configurado por `CLANGXX`/`CLANG_PATH`.
- `lld`/`wasm-ld` disponível no toolchain do Clang.

A UI usa WASM como caminho único de execução de firmware. Portanto, `clang++` e `wasm-ld` são necessários para rodar simulações de firmware localmente. Sem `clang++`, o servidor retorna `CLANG_UNAVAILABLE`. Sem `wasm-ld`, `/api/firmware/compile-wasm` retorna `WASM_TOOLCHAIN_UNAVAILABLE`.

Para uso público, não execute compilação de firmware diretamente no host sem isolamento. O compilador WASM suporta sandbox por container via `WASM_COMPILER_SANDBOX=docker` ou `WASM_COMPILER_SANDBOX=podman`.

## How To Install / Configure

### 1. Instalar dependências Node

```bash
npm install
```

### 2. Instalar Clang e wasm-ld

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install clang lld
```

Fedora:

```bash
sudo dnf install clang lld
```

Arch Linux:

```bash
sudo pacman -S clang lld
```

macOS com Homebrew:

```bash
brew install llvm
```

No macOS, se `clang++` do LLVM instalado pelo Homebrew não estiver no `PATH`, configure `CLANGXX`:

```bash
export CLANGXX="$(brew --prefix llvm)/bin/clang++"
```

Windows:

- Instale LLVM pelo instalador oficial ou pelo gerenciador de pacotes usado no seu ambiente.
- Garanta que `clang++.exe` e `wasm-ld.exe` estejam no `PATH`.
- Alternativamente, defina `CLANGXX` apontando para o executável.

Exemplo:

```powershell
$env:CLANGXX="C:\Program Files\LLVM\bin\clang++.exe"
```

### 3. Validar Clang e wasm-ld

```bash
clang++ --version
wasm-ld --version
```

Ou, se estiver usando variável de ambiente:

```bash
$CLANGXX --version
wasm-ld --version
```

### 4. Executar o projeto

```bash
npm ci
npm run dev
```

A aplicação sobe em `http://127.0.0.1:4173` por padrão.

### 5. Configurar sandbox de compilação WASM

Por padrão, o ambiente local usa `clang++` diretamente no host. Para um deploy público, configure um runtime de container:

```bash
export WASM_COMPILER_SANDBOX=docker
export WASM_COMPILER_IMAGE=virtual-embedded-lab-wasm-toolchain:latest
```

Também é possível usar Podman:

```bash
export WASM_COMPILER_SANDBOX=podman
export WASM_COMPILER_IMAGE=virtual-embedded-lab-wasm-toolchain:latest
```

O runner de container é chamado com rede desabilitada, limite de CPU, limite de memória e limite de processos. Variáveis opcionais:

- `WASM_COMPILER_CONTAINER_RUNTIME`: sobrescreve o binário `docker`/`podman`.
- `WASM_COMPILER_CPUS`: padrão `1`.
- `WASM_COMPILER_MEMORY`: padrão `256m`.
- `WASM_COMPILER_PIDS_LIMIT`: padrão `64`.

## Como Validar

```bash
npm test
```

Os testes usam o runner nativo do Node 24 com `--experimental-transform-types`.

## Estado Atual

- A UI carrega componentes oficiais por `GET /api/components`.
- Exemplos ficam em `examples/**/project.json` e são carregados pelo modal `Exemplos`.
- O exemplo default atual é `examples/hc-sr04-led-distance/project.json`.
- Há exemplos WASM para HC-SR04, ESP32 counter blink, ESP32 Wi-Fi Signal, ESP32 Wi-Fi Failover e FC-37 Rain Digital.
- Componentes oficiais ficam em `components/official/**/component.json`.
- O catálogo oficial já inclui Arduino UNO, ESP32 DevKitC V4, HC-SR04, FC-37 Rain Sensor, distância, Rain Environment, Wi-Fi Signal, resistores, capacitores e LEDs vermelho/verde/azul.
- O Arduino UNO expõe LED built-in `L` em D13/`LED_BUILTIN`; o ESP32 DevKitC V4 expõe `PWR` e LED programável `LD` em GPIO2/`LED_BUILTIN`.
- Sketches de blink em LED built-in rodam continuamente até Pause/Reset, respeitando `delay()` por tempo virtual e animando a timeline de `digitalWrite`; `LED_PIN`/`PIN` sem declaração são tratados como aliases de `LED_BUILTIN`.
- O board suporta pan/zoom, drag-and-drop, fios coloridos, remoção de fios/componentes, Undo/Redo em memória e import/export JSON.
- O painel inferior possui Código, Console, Serial e Problemas, com troca de view principal.
- O monitor de sinais fica acoplado ao inspector.
- O solver atual cobre caminho série simples LED/resistor, corrente, potência, sobrecorrente, resistência excessiva, tensão insuficiente e curtos básicos.
- A UI executa firmware pelo caminho WASM; falha de compilação WASM bloqueia a simulação e exibe diagnósticos, sem fallback para IR.
- A IR JavaScript ainda existe no código como legado/testes, mas está depreciada como caminho de execução de firmware, isolada em `legacy-ir-simulation.js` e não deve receber novas features.
- O servidor possui o endpoint `POST /api/firmware/compile-wasm`, que compila firmware C/C++ freestanding para WASM quando `clang++` e `lld/wasm-ld` estão disponíveis.
- Builds WASM bem-sucedidos são cacheados em memória por hash do código, constantes e configuração de toolchain/sandbox.
- O suporte ESP32/Wi-Fi cobre `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.RSSI(ssid)` e `WiFi.internetAvailable()` via imports WASM conectados ao `ArduinoRuntime`, usando componentes ambientais Wi-Fi Signal standalone como fontes de SSID, internet ativa e força de sinal.
- O suporte FC-37 cobre leitura digital por `digitalRead` em `DO`, alimentada pelo Rain Environment standalone sem resetar o tempo virtual quando a chuva muda.

## Limites Atuais

- Ainda não há Electron integrado.
- O solver ainda não é nodal/SPICE geral.
- A conexão ambiental ainda é desenhada como fio visual comum, apesar de ser serializada separadamente.
- O ESP32 ainda não substitui o Arduino UNO no solver de GPIO; o mapeamento genérico de pinos por manifest continua pendente.
- O firmware WASM ainda cobre um subset de Arduino/C++; APIs fora do shim bloqueiam a simulação até serem implementadas no caminho WASM.
- O FC-37 já expõe `AO` no manifest, mas leitura analógica por `analogRead` ainda está fora da entrega inicial.
- Fallback de compilação no browser foi avaliado e não faz parte do MVP público; o caminho recomendado é servidor com `clang++`/`wasm-ld` isolado por container.
- Undo/Redo existe apenas durante a sessão atual.
- O monitor de sinais ainda é contextual/ilustrativo, sem waveform temporal real.

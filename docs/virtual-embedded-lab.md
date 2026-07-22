# Virtual Embedded Lab

> **Nota de status:** este documento registra a visão e os requisitos originais do produto. O estado técnico implementado e as decisões atuais estão consolidados em `README.md`, `docs/architecture.md`, `docs/ui-decisions.md`, `docs/roadmap.md` e `../TODO.md`.

## 1. Visão geral

O **Virtual Embedded Lab** é uma plataforma visual para criação, programação e simulação de projetos eletrônicos e embarcados.

A proposta é permitir que o usuário monte circuitos por meio de uma interface drag-and-drop, conecte microcontroladores, sensores, resistores, LEDs, motores e outros componentes, escreva código real compatível com Arduino e execute esse código em um ambiente virtual.

O sistema não pretende inicialmente emular, ciclo a ciclo, o processador físico de cada microcontrolador. Em vez disso, utilizará uma abordagem de **simulação comportamental de firmware e circuito**, baseada em:

- interpretação ou instrumentação de código C/C++ por meio do Clang;
- implementação virtual das APIs públicas do Arduino e, futuramente, ESP-IDF e outros frameworks;
- simulação de sinais digitais e analógicos;
- cálculo de tensão, corrente, resistência e potência;
- componentes extensíveis descritos por manifestos JSON;
- comportamentos implementados por máquinas de estado ou scripts isolados;
- geração assistida por IA de novos componentes a partir de datasheets e documentação técnica.

O produto deve combinar a facilidade de ferramentas visuais com a capacidade de executar código próximo daquele que será usado no hardware real.

---

## 2. Objetivo do produto

Criar um ambiente em que o usuário possa:

1. Arrastar componentes para uma bancada virtual.
2. Conectar os terminais por fios.
3. Configurar propriedades elétricas e comportamentais.
4. Escrever código C/C++ no formato Arduino.
5. Executar o código em um runtime virtual.
6. Visualizar tensões, correntes, estados digitais e animações.
7. Identificar erros elétricos antes de montar o circuito real.
8. Adicionar novos componentes por meio de manifestos e modelos gerados com auxílio de IA.

A aplicação deverá ser útil para:

- prototipação rápida;
- aprendizado de eletrônica e sistemas embarcados;
- validação lógica de firmware;
- testes de sensores e atuadores;
- simulação de falhas;
- documentação visual de projetos;
- criação de bibliotecas comunitárias de componentes.

---

## 3. Princípios de arquitetura

### 3.1 Código real, hardware virtual

O código do usuário deve continuar parecido com código Arduino real:

```cpp
const int TRIGGER_PIN = 7;
const int ECHO_PIN = 6;
const int LED_PIN = 13;

void setup()
{
    pinMode(TRIGGER_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);
}

void loop()
{
    digitalWrite(TRIGGER_PIN, LOW);
    delayMicroseconds(2);

    digitalWrite(TRIGGER_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGGER_PIN, LOW);

    const unsigned long duration = pulseIn(ECHO_PIN, HIGH);
    const float distanceCm = duration / 58.0;

    digitalWrite(LED_PIN, distanceCm < 100.0 ? HIGH : LOW);

    delay(50);
}
```

O runtime deverá executar construções da linguagem C/C++ e encaminhar funções como `digitalWrite`, `delayMicroseconds` e `pulseIn` para implementações virtuais.

### 3.2 Componentes reagem a sinais, não ao código-fonte

O simulador não deve procurar por nomes específicos de bibliotecas, como `HCSR04`, `NewPing` ou similares.

O HC-SR04 virtual deve reagir ao que acontece em seus terminais:

- tensão aplicada ao VCC;
- referência de GND;
- pulso recebido no TRIG;
- geração de um pulso no ECHO;
- distância obtida por meio de uma entrada ambiental.

Com isso, qualquer biblioteca que use as primitivas suportadas poderá funcionar sem integração específica.

### 3.3 Separação entre comportamento e eletricidade

Cada componente poderá possuir três camadas:

1. **Manifesto estrutural** em JSON.
2. **Modelo elétrico**, implementado com primitivas, equações ou SPICE.
3. **Modelo comportamental**, implementado por máquina de estados, TypeScript, JavaScript ou WebAssembly isolado.

### 3.4 Tempo virtual determinístico

O sistema não deve depender diretamente de `setTimeout()` para representar microssegundos ou milissegundos simulados.

Deve existir um relógio virtual e uma fila ordenada de eventos. Esse mecanismo permitirá:

- pausar a simulação;
- avançar passo a passo;
- acelerar ou desacelerar o tempo;
- reproduzir cenários;
- testar timeouts;
- simular pulsos com precisão lógica;
- manter resultados determinísticos.

---

## 4. Escopo inicial do MVP

O MVP deverá validar todo o fluxo principal do produto com um conjunto pequeno de componentes.

### 4.1 Componentes suportados

#### Microcontrolador

- Arduino UNO.
- Perfil baseado no ATmega328P, sem emulação do processador.
- Tensão lógica nominal de 5 V.
- Pinos digitais.
- Entradas analógicas.
- PWM básico.
- LED interno opcional no pino 13.

#### Resistores

Valores inicialmente disponíveis:

- 100 Ω;
- 220 Ω;
- 330 Ω;
- 470 Ω;
- 1 kΩ;
- 2,2 kΩ;
- 4,7 kΩ;
- 10 kΩ.

O componente resistor deverá permitir também edição manual do valor entre 100 Ω e 10 kΩ.

Propriedades mínimas:

- resistência nominal;
- tolerância;
- potência máxima;
- corrente calculada;
- queda de tensão calculada;
- potência dissipada calculada.

#### LEDs

Inicialmente:

- LED vermelho;
- LED verde;
- LED azul.

Propriedades mínimas:

- anodo;
- catodo;
- tensão direta aproximada;
- corrente recomendada;
- corrente máxima;
- brilho visual proporcional à corrente;
- aviso de sobrecorrente;
- estado de dano opcional.

#### Sensor ultrassônico HC-SR04

Terminais:

- VCC;
- TRIG;
- ECHO;
- GND.

Comportamento mínimo:

- exigir alimentação adequada;
- detectar pulso válido no TRIG;
- consultar a distância fornecida pelo ambiente;
- gerar pulso proporcional no ECHO;
- permanecer inativo quando não alimentado;
- indicar sobretensão em entradas incompatíveis, quando aplicável.

#### Controle de distância

Componente visual que representa um obstáculo móvel.

Características:

- baseado em `input[type="range"]`;
- valor mínimo configurável;
- valor máximo configurável;
- unidade inicial em centímetros;
- conexão lógica com a entrada ambiental do HC-SR04;
- valor atual visível;
- possibilidade futura de animação em uma área 2D.

Esse controle não deverá ser tratado como um componente elétrico comum. Ele será um **componente ambiental**.

---

## 5. Projeto inicial de validação

### 5.1 Objetivo

Montar um projeto em que:

- o HC-SR04 mede a distância até um obstáculo virtual;
- quando a distância fica abaixo de 1 metro, um LED acende;
- quando a distância volta a ser igual ou superior a 1 metro, o LED apaga.

### 5.2 Componentes usados

- 1 Arduino UNO;
- 1 HC-SR04;
- 1 LED;
- 1 resistor entre 220 Ω e 330 Ω;
- 1 controle de distância;
- fios virtuais.

### 5.3 Ligações sugeridas

| Origem | Destino |
|---|---|
| Arduino 5V | HC-SR04 VCC |
| Arduino GND | HC-SR04 GND |
| Arduino D7 | HC-SR04 TRIG |
| Arduino D6 | HC-SR04 ECHO |
| Arduino D13 | Resistor |
| Resistor | LED anodo |
| LED catodo | Arduino GND |
| Controle de distância | Entrada ambiental do HC-SR04 |

### 5.4 Código de referência

```cpp
const int TRIGGER_PIN = 7;
const int ECHO_PIN = 6;
const int LED_PIN = 13;

void setup()
{
    pinMode(TRIGGER_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);

    digitalWrite(TRIGGER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
}

void loop()
{
    digitalWrite(TRIGGER_PIN, LOW);
    delayMicroseconds(2);

    digitalWrite(TRIGGER_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGGER_PIN, LOW);

    const unsigned long echoDuration = pulseIn(ECHO_PIN, HIGH, 30000);
    const float distanceCm = echoDuration / 58.0;

    if (echoDuration > 0 && distanceCm < 100.0) {
        digitalWrite(LED_PIN, HIGH);
    } else {
        digitalWrite(LED_PIN, LOW);
    }

    delay(50);
}
```

### 5.5 Resultado esperado

1. O usuário inicia a simulação.
2. O Arduino executa `setup()`.
3. O runtime passa a executar `loop()` repetidamente.
4. O HC-SR04 recebe pulsos no TRIG.
5. O controle de distância informa ao sensor a distância atual.
6. O sensor gera um pulso no ECHO.
7. `pulseIn()` retorna a duração do pulso.
8. O código converte a duração em distância.
9. O pino do LED muda de estado.
10. O solver calcula a corrente no LED.
11. A interface atualiza o brilho e o estado visual do LED.

### 5.6 Critérios de aceite

O projeto de validação será considerado concluído quando:

- for possível arrastar todos os componentes para o board;
- for possível conectá-los visualmente;
- o editor aceitar o código de referência;
- o código for analisado e executado pelo runtime;
- o HC-SR04 responder a pulsos no TRIG;
- o controle de distância alterar o valor ambiental do sensor;
- o LED acender abaixo de 100 cm;
- o LED apagar a partir de 100 cm;
- o sistema calcular a corrente no resistor e no LED;
- o sistema detectar LED sem resistor ou resistor inadequado;
- o usuário conseguir iniciar, pausar e reiniciar a simulação;
- o monitor de sinais mostrar TRIG, ECHO e LED;
- os resultados forem determinísticos entre execuções iguais.

---

## 6. Arquitetura proposta

```text
Application
├── Visual Workspace
│   ├── Component Palette
│   ├── Board Canvas
│   ├── Wiring Tool
│   ├── Property Inspector
│   └── Environment Controls
│
├── Code Workspace
│   ├── Code Editor
│   ├── Diagnostics
│   ├── Runtime Console
│   └── Signal Monitor
│
├── Firmware Engine
│   ├── Arduino Preprocessor
│   ├── Clang Frontend
│   ├── AST Normalizer
│   ├── Instrumentation Layer
│   ├── C++ Runtime
│   └── Arduino API Adapter
│
├── Simulation Kernel
│   ├── Virtual Clock
│   ├── Event Scheduler
│   ├── Digital Signal Engine
│   ├── Basic Electrical Solver
│   ├── Environment Engine
│   └── Failure Detector
│
├── Component Runtime
│   ├── Manifest Loader
│   ├── JSON Schema Validator
│   ├── Electrical Models
│   ├── Behavioral Sandbox
│   └── Component Test Runner
│
├── Component Registry
│   ├── Built-in Components
│   ├── Local Components
│   ├── Community Components
│   └── AI-generated Drafts
│
└── Persistence
    ├── Project Files
    ├── Component Packages
    ├── User Preferences
    └── Simulation Snapshots
```

---

## 7. Interface visual

### 7.1 Tecnologia inicial

A interface poderá usar:

- HTML;
- CSS;
- JavaScript ou TypeScript;
- jQuery;
- jQuery UI;
- SVG para componentes e fios;
- Monaco Editor ou CodeMirror para o editor de código;
- Electron como aplicação desktop local-first.

O uso de jQuery UI é adequado para o primeiro protótipo por fornecer:

- draggable;
- droppable;
- selectable;
- resizable;
- sortable;
- sliders;
- dialogs;
- tooltips.

### 7.2 Layout inicial

```text
┌─────────────────────────────────────────────────────────────┐
│ Menu: Projeto | Componentes | Simulação | Visualização      │
├───────────────┬─────────────────────────────┬───────────────┤
│ Componentes   │                             │ Propriedades  │
│               │        Board visual         │               │
│ Arduino UNO   │                             │ Pino          │
│ HC-SR04       │                             │ Resistência   │
│ LED           │                             │ Tensão        │
│ Resistor      │                             │ Corrente      │
│ Distância     │                             │ Estado        │
├───────────────┴─────────────────────────────┴───────────────┤
│ Código | Console | Sinais | Problemas                       │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Comportamentos de interação

#### Drag-and-drop

Os componentes serão arrastados da paleta para o board.

Cada instância deverá possuir:

- ID único;
- posição;
- rotação futura;
- propriedades;
- terminais;
- estado visual;
- referência ao manifesto.

#### Conexão de fios

Fluxo sugerido:

1. Usuário clica em um terminal.
2. A aplicação inicia um fio temporário.
3. Usuário move o cursor.
4. Terminais compatíveis são destacados.
5. Usuário clica no terminal de destino.
6. A aplicação cria uma net virtual.

#### Controle de distância

O controle deverá ser um widget arrastável com slider do jQuery UI.

Exemplo conceitual:

```html
<div class="environment-distance-control">
    <label>Distância</label>
    <div class="distance-slider"></div>
    <output>150 cm</output>
</div>
```

Quando conectado ao HC-SR04, a alteração do slider deve atualizar o canal ambiental do sensor.

---

## 8. Representação de projetos

Um projeto poderá ser salvo em JSON.

```json
{
  "schemaVersion": "1.0.0",
  "name": "HC-SR04 com LED",
  "board": {
    "width": 1600,
    "height": 900,
    "gridSize": 10
  },
  "components": [
    {
      "id": "arduino-1",
      "componentId": "board.arduino.uno",
      "position": { "x": 300, "y": 250 },
      "properties": {}
    },
    {
      "id": "sensor-1",
      "componentId": "sensor.ultrasonic.hc-sr04",
      "position": { "x": 700, "y": 200 },
      "properties": {}
    },
    {
      "id": "led-1",
      "componentId": "electronic.led.red",
      "position": { "x": 700, "y": 500 },
      "properties": {}
    },
    {
      "id": "resistor-1",
      "componentId": "electronic.resistor",
      "position": { "x": 550, "y": 500 },
      "properties": {
        "resistanceOhms": 220
      }
    },
    {
      "id": "distance-1",
      "componentId": "environment.distance-range",
      "position": { "x": 1050, "y": 200 },
      "properties": {
        "valueCm": 150,
        "minCm": 2,
        "maxCm": 400
      }
    }
  ],
  "connections": [
    {
      "id": "net-1",
      "terminals": [
        "arduino-1.5v",
        "sensor-1.vcc"
      ]
    },
    {
      "id": "net-2",
      "terminals": [
        "arduino-1.gnd",
        "sensor-1.gnd",
        "led-1.cathode"
      ]
    },
    {
      "id": "net-3",
      "terminals": [
        "arduino-1.d7",
        "sensor-1.trigger"
      ]
    },
    {
      "id": "net-4",
      "terminals": [
        "arduino-1.d6",
        "sensor-1.echo"
      ]
    },
    {
      "id": "net-5",
      "terminals": [
        "arduino-1.d13",
        "resistor-1.a"
      ]
    },
    {
      "id": "net-6",
      "terminals": [
        "resistor-1.b",
        "led-1.anode"
      ]
    }
  ],
  "environmentConnections": [
    {
      "source": "distance-1.distance",
      "target": "sensor-1.obstacleDistance"
    }
  ],
  "code": {
    "language": "arduino-cpp",
    "entry": "main.ino",
    "files": {
      "main.ino": "..."
    }
  }
}
```

---

## 9. Modelo de componente

### 9.1 Pacote de componente

```text
components/hc-sr04/
├── component.json
├── behavior.ts
├── symbol.svg
├── preview.png
├── sources.json
└── tests/
    ├── trigger-10us.json
    ├── distance-100cm.json
    └── no-power.json
```

Nem todos os arquivos serão obrigatórios.

### 9.2 Manifesto mínimo

```json
{
  "$schema": "component.schema.json",
  "schemaVersion": "1.0.0",
  "identity": {
    "id": "sensor.ultrasonic.hc-sr04",
    "name": "HC-SR04",
    "category": "sensor"
  },
  "visual": {
    "symbol": "symbol.svg"
  },
  "terminals": [],
  "electricalModel": {},
  "behavior": {}
}
```

### 9.3 Tipos de componentes

#### Elétricos primitivos

- resistor;
- fonte;
- LED;
- chave;
- capacitor futuramente;
- diodo futuramente.

#### Componentes comportamentais

- HC-SR04;
- DHT22 futuramente;
- relé futuramente;
- servo futuramente;
- motores futuramente.

#### Microcontroladores

- Arduino UNO inicialmente;
- ESP8266 futuramente;
- ESP32 e sua família futuramente;
- STM32 e RP2040 futuramente.

#### Componentes ambientais

- controle de distância;
- temperatura;
- umidade;
- luminosidade;
- presença;
- posição;
- velocidade.

---

## 10. Manifesto sugerido para o resistor

```json
{
  "$schema": "component.schema.json",
  "schemaVersion": "1.0.0",
  "identity": {
    "id": "electronic.resistor",
    "name": "Resistor",
    "category": "passive"
  },
  "properties": {
    "resistanceOhms": {
      "type": "number",
      "default": 220,
      "minimum": 100,
      "maximum": 10000,
      "unit": "ohm"
    },
    "tolerancePercent": {
      "type": "number",
      "default": 5,
      "unit": "%"
    },
    "maximumPowerWatts": {
      "type": "number",
      "default": 0.25,
      "unit": "W"
    }
  },
  "terminals": [
    {
      "id": "a",
      "label": "A",
      "type": "passive"
    },
    {
      "id": "b",
      "label": "B",
      "type": "passive"
    }
  ],
  "electricalModel": {
    "type": "primitive",
    "primitive": "resistor",
    "resistanceProperty": "resistanceOhms"
  }
}
```

---

## 11. Manifesto sugerido para o LED

```json
{
  "$schema": "component.schema.json",
  "schemaVersion": "1.0.0",
  "identity": {
    "id": "electronic.led.red",
    "name": "LED vermelho",
    "category": "semiconductor"
  },
  "properties": {
    "forwardVoltage": {
      "type": "number",
      "default": 2.0,
      "unit": "V"
    },
    "recommendedCurrent": {
      "type": "number",
      "default": 0.01,
      "unit": "A"
    },
    "maximumCurrent": {
      "type": "number",
      "default": 0.02,
      "unit": "A"
    }
  },
  "terminals": [
    {
      "id": "anode",
      "label": "Anodo",
      "type": "passive"
    },
    {
      "id": "cathode",
      "label": "Catodo",
      "type": "ground-capable"
    }
  ],
  "electricalModel": {
    "type": "primitive",
    "primitive": "led",
    "forwardVoltageProperty": "forwardVoltage"
  },
  "visualBehavior": {
    "brightnessSource": "electrical.current",
    "warningThresholdProperty": "maximumCurrent"
  }
}
```

---

## 12. Manifesto sugerido para o HC-SR04

```json
{
  "$schema": "component.schema.json",
  "schemaVersion": "1.0.0",
  "identity": {
    "id": "sensor.ultrasonic.hc-sr04",
    "name": "HC-SR04",
    "category": "sensor",
    "subCategory": "ultrasonic-distance"
  },
  "power": {
    "recommendedVoltage": {
      "min": 4.5,
      "typical": 5.0,
      "max": 5.5,
      "unit": "V"
    }
  },
  "terminals": [
    {
      "id": "vcc",
      "label": "VCC",
      "type": "power-input"
    },
    {
      "id": "trigger",
      "label": "TRIG",
      "type": "digital-input"
    },
    {
      "id": "echo",
      "label": "ECHO",
      "type": "digital-output"
    },
    {
      "id": "gnd",
      "label": "GND",
      "type": "ground"
    }
  ],
  "environmentInputs": [
    {
      "id": "obstacleDistance",
      "label": "Distância do obstáculo",
      "type": "distance",
      "minimum": 2,
      "maximum": 400,
      "unit": "cm"
    }
  ],
  "behavior": {
    "engine": "state-machine",
    "entry": "behavior.ts",
    "parameters": {
      "minimumTriggerPulseUs": 10,
      "echoMicrosecondsPerCentimeter": 58
    }
  }
}
```

---

## 13. Firmware Engine com Clang

### 13.1 Responsabilidades

O Firmware Engine deverá:

- receber arquivos `.ino`, `.h`, `.hpp`, `.c` e `.cpp`;
- reproduzir o pré-processamento básico do Arduino;
- resolver includes suportados;
- executar o pré-processador do Clang;
- gerar AST semanticamente analisada;
- validar tipos e chamadas;
- instrumentar loops e pontos bloqueantes;
- converter a AST para uma representação intermediária executável;
- manter stack, scopes, variáveis e objetos;
- conectar chamadas Arduino ao runtime virtual.

### 13.2 Estratégia inicial

A primeira versão não precisa suportar todo o C++.

O objetivo inicial será suportar o subconjunto necessário para:

- constantes;
- variáveis globais e locais;
- tipos inteiros e ponto flutuante;
- arrays básicos;
- funções;
- parâmetros;
- retorno;
- `if` e `else`;
- `for`;
- `while`;
- operadores matemáticos e lógicos;
- chamadas de funções nativas;
- `setup()`;
- `loop()`.

Classes e bibliotecas complexas poderão entrar depois.

### 13.3 APIs Arduino iniciais

- `pinMode()`;
- `digitalWrite()`;
- `digitalRead()`;
- `analogRead()`;
- `analogWrite()`;
- `millis()`;
- `micros()`;
- `delay()`;
- `delayMicroseconds()`;
- `pulseIn()`;
- `Serial.begin()`;
- `Serial.print()`;
- `Serial.println()`.

### 13.4 Instrumentação

Loops deverão receber checkpoints para evitar travamento do host.

Representação conceitual:

```cpp
while (condition) {
    __virtual_runtime_checkpoint();
    body();
}
```

O checkpoint deverá permitir:

- pausar a execução;
- consumir orçamento virtual de CPU;
- alternar contexto;
- detectar loops infinitos;
- avançar o scheduler quando necessário.

---

## 14. Runtime Arduino virtual

O runtime deverá expor contratos independentes da interface visual.

```typescript
interface ArduinoRuntime {
    pinMode(pin: number, mode: PinMode): void;
    digitalWrite(pin: number, value: DigitalValue): void;
    digitalRead(pin: number): DigitalValue;
    analogRead(pin: number): number;
    analogWrite(pin: number, value: number): void;
    millis(): number;
    micros(): number;
    delay(milliseconds: number): RuntimeYield;
    delayMicroseconds(microseconds: number): RuntimeYield;
    pulseIn(
        pin: number,
        value: DigitalValue,
        timeoutMicroseconds?: number
    ): RuntimeYield<number>;
}
```

O runtime não deve manipular diretamente o LED ou o HC-SR04. Ele deve operar exclusivamente sobre pinos e periféricos da placa virtual.

---

## 15. Motor elétrico inicial

### 15.1 Escopo

O MVP deve possuir um solver elétrico básico, suficiente para:

- fontes DC;
- terra;
- resistores;
- LEDs aproximados;
- saídas GPIO;
- entradas GPIO;
- nets;
- circuitos abertos;
- curtos simples;
- cálculo de tensão;
- cálculo de corrente;
- cálculo de potência.

### 15.2 Modelo básico de GPIO

Saída `HIGH` do Arduino UNO:

- fonte equivalente de aproximadamente 5 V;
- resistência de saída configurável;
- limite recomendado de corrente;
- detecção de sobrecarga.

Saída `LOW`:

- tensão próxima de 0 V;
- capacidade limitada de drenar corrente.

Entrada:

- alta impedância;
- limiar para HIGH;
- limiar para LOW;
- estado indefinido entre os limiares;
- suporte futuro a pull-up interno.

### 15.3 Modelo básico do LED

A primeira implementação pode usar um modelo por partes:

```text
Se tensão direta < Vf:
    corrente aproximadamente zero

Se tensão direta >= Vf:
    LED conduz e a corrente é determinada pelo restante do circuito
```

O brilho pode ser calculado com base na corrente:

```text
brightness = clamp(current / recommendedCurrent, 0, 1)
```

### 15.4 Avisos elétricos

O sistema deverá gerar problemas como:

- LED conectado sem resistor;
- resistor com potência insuficiente;
- pino do Arduino acima da corrente recomendada;
- curto entre 5 V e GND;
- entrada flutuante;
- componente não alimentado;
- polaridade invertida;
- tensão fora da faixa recomendada;
- tensão acima do máximo absoluto, quando conhecida.

---

## 16. Barramento de sinais e nets

Uma net representa um conjunto de terminais eletricamente conectados.

```typescript
interface VirtualNet {
    id: string;
    terminals: TerminalReference[];
    voltage: number | null;
    currentBalance: number;
    state: NetState;
}
```

Estados possíveis:

```typescript
type NetState =
    | 'stable'
    | 'floating'
    | 'conflict'
    | 'overloaded'
    | 'unknown';
```

O sistema deve atualizar apenas partes afetadas do circuito quando possível.

---

## 17. Comportamento do HC-SR04

### 17.1 Máquina de estados

Estados sugeridos:

```text
POWERED_OFF
IDLE
TRIGGER_HIGH
WAITING_ECHO_START
ECHO_HIGH
ERROR
```

### 17.2 Fluxo

1. Verificar alimentação.
2. Observar TRIG.
3. Registrar o instante da borda de subida.
4. Registrar o instante da borda de descida.
5. Calcular a largura do pulso.
6. Ignorar pulsos menores que o mínimo configurado.
7. Consultar `obstacleDistance`.
8. Calcular a duração do ECHO.
9. Agendar subida do ECHO.
10. Agendar descida do ECHO.

### 17.3 Exemplo conceitual

```typescript
class Hcsr04Behavior {
    private triggerStartedAtUs: number | null = null;

    onTerminalChanged(
        terminalId: string,
        state: TerminalState
    ): void {
        if (terminalId !== 'trigger') {
            return;
        }

        if (state.logicState === 'high') {
            this.triggerStartedAtUs ??= state.timeUs;
            return;
        }

        if (
            state.logicState === 'low' &&
            this.triggerStartedAtUs !== null
        ) {
            const durationUs = state.timeUs - this.triggerStartedAtUs;
            this.triggerStartedAtUs = null;

            if (durationUs >= 10) {
                this.scheduleEcho();
            }
        }
    }

    private scheduleEcho(): void {
        const distanceCm = this.environment.read(
            'obstacleDistance'
        );

        const echoDurationUs = distanceCm * 58;

        this.scheduler.scheduleIn(100, () => {
            this.terminals.echo.driveHigh();
        });

        this.scheduler.scheduleIn(
            100 + echoDurationUs,
            () => {
                this.terminals.echo.driveLow();
            }
        );
    }
}
```

---

## 18. Motor de ambiente

O Environment Engine representa grandezas externas ao circuito.

Exemplos futuros:

- distância;
- temperatura;
- umidade;
- iluminação;
- pressão;
- aceleração;
- rotação;
- presença;
- nível de líquido.

Interface sugerida:

```typescript
interface EnvironmentChannel<TValue = number> {
    id: string;
    type: string;
    value: TValue;
    unit?: string;
    sourceComponentId?: string;
}
```

O controle de distância produzirá um canal ambiental.

O HC-SR04 consumirá esse canal.

Essa ligação não deverá entrar no solver elétrico.

---

## 19. Geração de componentes por IA

### 19.1 Objetivo

Permitir que o usuário pesquise um componente, sensor ou placa e gere um pacote inicial compatível com o produto.

Exemplos:

- BME280;
- DHT22;
- MPU6050;
- ESP32-C3 Super Mini;
- módulo de relé;
- motor específico;
- transistor específico.

### 19.2 Fluxo proposto

```text
Usuário informa fabricante e modelo
        ↓
Agente pesquisa documentação oficial
        ↓
Identifica datasheets e pinagem
        ↓
Extrai parâmetros elétricos
        ↓
Identifica protocolo ou comportamento
        ↓
Gera component.json
        ↓
Gera behavior.ts quando necessário
        ↓
Gera modelo elétrico
        ↓
Gera testes
        ↓
Executa validações automáticas
        ↓
Apresenta rascunho ao usuário
        ↓
Usuário revisa e instala localmente
```

### 19.3 Regras de segurança e qualidade

A IA não deverá instalar ou publicar diretamente um componente sem revisão.

Todo campo técnico deverá possuir:

- valor;
- unidade;
- fonte;
- página ou seção quando disponível;
- nível de confiança;
- status de verificação.

Exemplo:

```json
{
  "field": "power.recommendedVoltage.max",
  "value": 5.5,
  "unit": "V",
  "source": {
    "type": "datasheet",
    "document": "HC-SR04 Datasheet",
    "page": 2
  },
  "confidence": 0.98,
  "verificationStatus": "pending-review"
}
```

Quando um dado não for encontrado, deverá ser marcado como desconhecido.

A IA não deverá inventar valores elétricos.

### 19.4 Estados de confiança

- oficial;
- verificado;
- comunitário;
- gerado por IA;
- não verificado;
- incompatível;
- incompleto.

### 19.5 Sandboxing

Scripts comportamentais de componentes devem executar em ambiente isolado.

Devem ser proibidos:

- acesso ao sistema de arquivos;
- acesso direto à rede;
- execução de processos;
- acesso ao DOM principal;
- imports arbitrários;
- uso ilimitado de CPU;
- uso ilimitado de memória.

---

## 20. Plano de desenvolvimento

## Fase 0 — Fundação do projeto

### Objetivos

- criar o repositório;
- definir padrões arquiteturais;
- criar os contratos principais;
- preparar o ambiente desktop;
- definir formatos versionados.

### Tarefas

- configurar Electron;
- configurar TypeScript;
- configurar jQuery e jQuery UI;
- configurar bundler;
- configurar testes;
- configurar lint e formatação;
- criar estrutura de módulos;
- criar `project.schema.json`;
- criar `component.schema.json`;
- criar contratos de componentes, terminais, nets e ambiente.

### Entregáveis

- aplicação abre localmente;
- janela principal renderizada;
- estrutura de diretórios criada;
- schemas validados por testes.

---

## Fase 1 — Editor visual

### Objetivos

Criar o board drag-and-drop sem simulação.

### Tarefas

- criar paleta de componentes;
- implementar `draggable`;
- implementar `droppable`;
- criar instâncias visuais;
- criar seleção;
- criar painel de propriedades;
- criar exclusão;
- criar movimentação;
- implementar zoom e pan básicos;
- implementar salvamento e carregamento;
- implementar grid opcional.

### Entregáveis

- Arduino, resistor, LED, HC-SR04 e distância podem ser colocados no board;
- posições são preservadas;
- propriedades podem ser alteradas;
- projeto pode ser salvo e reaberto.

---

## Fase 2 — Terminais, fios e nets

### Objetivos

Criar conexões visuais e representação elétrica.

### Tarefas

- renderizar terminais;
- iniciar conexão ao clicar em terminal;
- desenhar fio temporário;
- finalizar conexão;
- criar nets;
- remover fios;
- destacar conexões inválidas;
- permitir múltiplos terminais na mesma net;
- atualizar fios quando componentes forem movidos;
- serializar conexões.

### Entregáveis

- usuário conecta todos os componentes do projeto de validação;
- nets são persistidas;
- conexões inválidas são bloqueadas ou sinalizadas.

---

## Fase 3 — Relógio e scheduler

### Objetivos

Construir a base temporal da simulação.

### Tarefas

- criar relógio virtual;
- criar fila de prioridade de eventos;
- criar eventos canceláveis;
- criar start, pause e reset;
- criar avanço por evento;
- criar multiplicador de velocidade;
- criar modo determinístico;
- criar logs de eventos.

### Entregáveis

- eventos são executados na ordem correta;
- a simulação pode ser pausada;
- execuções idênticas produzem resultados idênticos.

---

## Fase 4 — Solver elétrico básico

### Objetivos

Calcular tensão, corrente, resistência e potência no circuito inicial.

### Tarefas

- modelar fontes DC;
- modelar GND;
- modelar resistores;
- modelar GPIO HIGH e LOW;
- modelar GPIO INPUT;
- modelar LED aproximado;
- calcular corrente no circuito série;
- calcular queda de tensão;
- calcular potência;
- detectar circuito aberto;
- detectar curto simples;
- detectar sobrecorrente;
- criar overlay de tensão e corrente.

### Entregáveis

- LED com resistor funciona eletricamente;
- corrente é exibida;
- resistor inadequado gera aviso;
- curto gera erro.

---

## Fase 5 — Runtime Arduino mínimo

### Objetivos

Executar um subconjunto controlado de código Arduino.

### Tarefas

- integrar Clang;
- preprocessar `.ino`;
- gerar AST;
- normalizar AST;
- executar variáveis e expressões;
- executar funções;
- executar `if`, `for` e `while`;
- localizar `setup()` e `loop()`;
- implementar chamadas nativas;
- implementar checkpoints;
- exibir erros de compilação e runtime.

### APIs iniciais

- `pinMode`;
- `digitalWrite`;
- `digitalRead`;
- `delay`;
- `delayMicroseconds`;
- `millis`;
- `micros`.

### Entregáveis

- código Blink acende e apaga um LED virtual;
- erros aparecem no editor;
- pausa interrompe o runtime sem travar a interface.

---

## Fase 6 — HC-SR04 e pulseIn

### Objetivos

Completar o projeto inicial de validação.

### Tarefas

- implementar comportamento do HC-SR04;
- implementar controle de distância;
- criar ligação ambiental;
- implementar `pulseIn`;
- bloquear e retomar a execução;
- gerar ECHO conforme distância;
- criar monitor visual do pulso;
- validar timeout.

### Entregáveis

- distância abaixo de 100 cm acende o LED;
- distância a partir de 100 cm apaga o LED;
- alteração do slider produz resposta imediata no próximo ciclo;
- TRIG e ECHO podem ser inspecionados.

---

## Fase 7 — Diagnósticos e experiência de uso

### Objetivos

Transformar o protótipo técnico em uma ferramenta compreensível.

### Tarefas

- painel de problemas;
- avisos elétricos;
- inspeção de nets;
- tooltips de tensão;
- tooltips de corrente;
- estado de alimentação;
- monitor serial;
- monitor de sinais;
- mensagens claras de incompatibilidade;
- histórico de eventos;
- exemplos prontos.

### Entregáveis

- usuário entende por que um circuito não funciona;
- valores elétricos podem ser vistos sem abrir logs técnicos;
- o projeto HC-SR04 é fornecido como exemplo.

---

## Fase 8 — Registro de componentes

### Objetivos

Permitir instalação local e versionamento de componentes.

### Tarefas

- criar registry local;
- instalar pacote de componente;
- remover componente;
- atualizar componente;
- validar schema;
- executar testes do componente;
- registrar origem e confiança;
- resolver dependências;
- diferenciar componentes oficiais e locais.

### Entregáveis

- componente externo pode ser instalado por pacote;
- componente inválido é rejeitado;
- versões são rastreadas.

---

## Fase 9 — Importador assistido por IA

### Objetivos

Gerar rascunhos de componentes a partir de documentação técnica.

### Tarefas

- criar formulário de pesquisa;
- definir formato de fontes;
- buscar documentação;
- extrair pinagem;
- extrair propriedades elétricas;
- gerar manifesto;
- gerar comportamento inicial;
- gerar testes;
- criar tela de revisão;
- bloquear instalação sem validação mínima;
- armazenar proveniência por campo.

### Entregáveis

- usuário pesquisa um componente;
- sistema gera rascunho rastreável;
- usuário revisa e instala localmente.

---

## Fase 10 — Expansão para ESP

### Objetivos

Adicionar suporte inicial à família ESP sem emulação de CPU.

### Ordem sugerida

1. ESP8266 com Arduino Core.
2. ESP32 clássico com Arduino Core.
3. ESP32-C3.
4. ESP32-S3.
5. APIs selecionadas do ESP-IDF.

### Recursos iniciais

- GPIO;
- ADC;
- PWM/LEDC;
- Serial;
- timers;
- Wi-Fi comportamental;
- MQTT real ou virtual;
- armazenamento virtual simples.

### Observação

A família ESP deverá reutilizar:

- o mesmo solver elétrico;
- o mesmo barramento;
- os mesmos sensores;
- o mesmo motor ambiental;
- o mesmo sistema de componentes.

Somente perfis, APIs e restrições mudarão.

---

## 21. Estrutura de repositório sugerida

```text
virtual-embedded-lab/
├── apps/
│   └── desktop/
│       ├── main/
│       ├── preload/
│       └── renderer/
│
├── packages/
│   ├── project-model/
│   ├── component-schema/
│   ├── component-runtime/
│   ├── simulation-kernel/
│   ├── electrical-solver/
│   ├── environment-engine/
│   ├── firmware-engine/
│   ├── arduino-runtime/
│   ├── visual-workspace/
│   ├── signal-monitor/
│   └── ai-component-importer/
│
├── components/
│   ├── official/
│   │   ├── arduino-uno/
│   │   ├── resistor/
│   │   ├── led-red/
│   │   ├── led-green/
│   │   ├── led-blue/
│   │   ├── hc-sr04/
│   │   └── distance-range/
│   └── local/
│
├── examples/
│   ├── blink/
│   └── hc-sr04-led-distance/
│
├── schemas/
│   ├── project.schema.json
│   ├── component.schema.json
│   └── test.schema.json
│
├── docs/
│   ├── architecture.md
│   ├── component-format.md
│   ├── runtime.md
│   └── roadmap.md
│
└── tests/
    ├── integration/
    ├── simulation/
    └── fixtures/
```

---

## 22. Estratégia de testes

### 22.1 Testes unitários

- parser e normalização da AST;
- expressões;
- fluxo de controle;
- scheduler;
- fila de eventos;
- solver de resistores;
- cálculo de potência;
- comportamento do LED;
- máquina de estados do HC-SR04;
- validação de schemas.

### 22.2 Testes de integração

- `digitalWrite` altera GPIO;
- GPIO altera net;
- net alimenta resistor;
- resistor limita corrente;
- LED recebe corrente;
- brilho é atualizado;
- TRIG aciona HC-SR04;
- ECHO desbloqueia `pulseIn`;
- código altera LED conforme distância.

### 22.3 Testes determinísticos

Executar o mesmo projeto com:

- mesma configuração;
- mesma distância;
- mesmo código;
- mesma sequência de eventos.

O resultado deverá ser idêntico.

### 22.4 Testes de segurança

- loop infinito;
- alocação excessiva;
- script de componente malicioso;
- tentativa de acesso a arquivos;
- tentativa de acesso à rede;
- componente com manifesto inválido;
- evento recursivo ilimitado.

---

## 23. Limitações assumidas no MVP

O MVP não deverá prometer:

- emulação de instruções AVR;
- compatibilidade completa com C++;
- temporização cycle-accurate;
- interrupções avançadas;
- registradores específicos do ATmega328P;
- assembly inline;
- DMA;
- SPICE completo;
- comportamento térmico realista;
- simulação precisa de radiofrequência;
- reprodução de defeitos de fabricação;
- suporte a qualquer biblioteca Arduino existente.

O posicionamento inicial deverá ser:

> Simulação comportamental e elétrica básica de projetos embarcados escritos sobre APIs suportadas.

---

## 24. Riscos técnicos

### 24.1 Complexidade de C++

C++ completo é grande demais para ser implementado diretamente de forma rápida.

Mitigação:

- usar Clang como frontend;
- definir subconjunto compatível;
- aumentar cobertura gradualmente;
- mostrar diagnósticos claros.

### 24.2 Sincronização entre firmware e solver

O runtime pode gerar mudanças rápidas de sinal enquanto o solver calcula o circuito.

Mitigação:

- scheduler único;
- eventos versionados;
- lotes de atualização;
- separação entre eventos digitais e resolução analógica.

### 24.3 Performance

Grandes circuitos ou muitos eventos podem ficar lentos.

Mitigação:

- atualização incremental;
- filas eficientes;
- workers;
- níveis de fidelidade;
- simplificação de modelos;
- modo lógico rápido.

### 24.4 Dados gerados por IA

Valores elétricos incorretos podem invalidar a simulação.

Mitigação:

- fontes por campo;
- revisão humana;
- testes automáticos;
- estados de confiança;
- proibição de publicação automática.

### 24.5 Modelos complexos de componentes

Nem todo componente pode ser descrito apenas com propriedades simples.

Mitigação:

- pacote modular;
- manifesto JSON;
- scripts comportamentais;
- modelos elétricos externos;
- integração futura com SPICE.

---

## 25. Decisões iniciais recomendadas

1. Usar Electron para o aplicativo local-first.
2. Usar TypeScript no núcleo.
3. Usar jQuery UI no editor visual inicial.
4. Usar SVG para componentes, terminais e fios.
5. Usar Clang para parsing e análise semântica.
6. Implementar um runtime próprio para APIs Arduino.
7. Criar relógio e scheduler antes dos sensores.
8. Implementar solver elétrico básico antes de integrar SPICE.
9. Tratar componentes ambientais separadamente dos elétricos.
10. Versionar manifestos desde o primeiro commit.
11. Exigir testes para componentes oficiais.
12. Tratar componentes gerados por IA como rascunhos não verificados.

---

## 26. Milestone principal do MVP

O primeiro milestone completo deverá demonstrar o seguinte fluxo:

```text
Usuário abre a aplicação
        ↓
Arrasta Arduino UNO, HC-SR04, resistor, LED e distância
        ↓
Conecta os terminais
        ↓
Escreve código Arduino
        ↓
Inicia a simulação
        ↓
Clang analisa o código
        ↓
Runtime executa setup e loop
        ↓
Arduino gera pulso no TRIG
        ↓
HC-SR04 lê a distância ambiental
        ↓
HC-SR04 gera pulso no ECHO
        ↓
pulseIn mede o pulso
        ↓
Código decide o estado do LED
        ↓
Solver calcula corrente e potência
        ↓
LED acende ou apaga visualmente
```

Esse milestone valida simultaneamente:

- editor visual;
- sistema de componentes;
- conexões;
- runtime C/C++;
- APIs Arduino;
- tempo virtual;
- componente comportamental;
- entrada ambiental;
- solver elétrico;
- animação;
- diagnósticos.

---

## 27. Próximos componentes após o MVP

Ordem sugerida:

1. Botão.
2. Potenciômetro.
3. Buzzer.
4. Relé.
5. Servo SG90.
6. Motor DC.
7. Ponte H L298N.
8. DHT22.
9. Display de sete segmentos.
10. LCD 16x2 com I²C.
11. ESP8266.
12. ESP32.

Essa sequência expande progressivamente:

- entradas digitais;
- entradas analógicas;
- PWM;
- atuadores;
- protocolos;
- bibliotecas;
- rede.

---

## 28. Definição de sucesso do projeto inicial

O projeto inicial será bem-sucedido quando demonstrar que a plataforma consegue representar, de forma integrada:

- código C/C++ próximo do real;
- comportamento de sensores baseado em sinais;
- relações elétricas entre componentes;
- grandezas ambientais externas;
- visualização animada;
- diagnóstico de erros;
- componentes descritos de forma extensível;
- base arquitetural reaproveitável para Arduino, ESP e outras famílias.

O objetivo não é reproduzir perfeitamente o silício na primeira versão. O objetivo é construir um núcleo coerente que possa crescer sem precisar ser refeito a cada novo microcontrolador ou sensor.

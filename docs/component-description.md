# Como um Componente e Descrito

Este documento descreve como um componente oficial e empacotado no Virtual Embedded Lab. Use isto como referencia pratica ao criar ou revisar componentes.

## Estrutura

Um componente oficial fica em `components/official/<slug>/`.

Estrutura recomendada:

```text
components/official/<slug>/
  component.json
  ui/
    styles.css
  simulation/
    behavior.js
  firmware/
    library.json
    wasm-imports.js
    shims/
      <library-or-api>.cpp
```

Nem todo componente precisa de todos os arquivos. Componentes puramente visuais ou passivos normalmente usam apenas `component.json`. Arquivos extras devem existir apenas quando o componente introduz visual especifico, comportamento simulado, APIs de firmware ou shims C++.

## Fonte de Verdade

`component.json` e a fonte de verdade do componente. Ele descreve:

- identidade e categoria;
- propriedades editaveis;
- terminais logicos;
- modelo eletrico;
- comportamento de simulacao;
- contribuicoes carregaveis;
- representacao visual no board e no catalogo.

O core deve ler essas informacoes de forma generica. Evite adicionar regras como `if (component.type === "...")` em `board-editor.js`, `arduino-runtime.js`, `wasm-import-adapters.js`, `wasm-compiler.mjs` ou `clang-analyzer.mjs` para casos que podem ser declarados no componente.

## Campos Principais do Manifest

### `identity`

Identifica o componente de forma estavel.

```json
{
  "identity": {
    "id": "sensor.environment.bmp280",
    "name": "BMP280 Pressure/Temperature",
    "category": "sensor",
    "subCategory": "pressure-temperature"
  }
}
```

Use `identity.id` como identificador semantico estavel. O tipo visual usado em projetos fica em `visual.type`.

### `simulation`

Declara o papel do componente.

```json
{
  "simulation": {
    "kind": "behavioral-sensor",
    "effects": ["firmware", "environment", "electrical", "visual-state"],
    "implemented": true
  }
}
```

Valores comuns de `kind`:

- `visual-only`: elemento sem impacto eletrico ou firmware.
- `passive-electrical`: resistor, capacitor e outros passivos.
- `active-electrical`: LED, buzzer, relay e cargas ativas simples.
- `behavioral-sensor`: sensor que gera leitura para firmware.
- `environment-source`: fonte ambiental, como clima, chuva, luz ou Wi-Fi.
- `microcontroller`: placa que executa firmware.

Use `effects` para declarar quais subsistemas o componente afeta: `electrical`, `firmware`, `environment` e `visual-state`.

### `properties` e `variants`

`properties` guarda estado persistido e valores editaveis no inspector.

```json
{
  "properties": {
    "i2cAddress": {
      "type": "number",
      "default": 118,
      "minimum": 118,
      "maximum": 119,
      "simulationUpdate": "rerun"
    }
  },
  "variants": {
    "i2cAddress": [
      { "label": "I2C 0x76", "value": 118 },
      { "label": "I2C 0x77", "value": 119 }
    ]
  }
}
```

Use `simulationUpdate: "live"` quando a mudanca pode ser aplicada sem reiniciar o firmware. Use `"rerun"` quando o estado do firmware precisa ser reconstruido.

### `terminals`

Declara os pontos conectaveis logicos usados por conexoes, solver, barramentos e serializacao.

```json
{
  "terminals": [
    { "id": "vcc", "label": "VCC", "type": "power-input" },
    { "id": "gnd", "label": "GND", "type": "ground" },
    { "id": "scl", "label": "SCL", "type": "i2c-scl" },
    { "id": "sda", "label": "SDA", "type": "i2c-sda" }
  ]
}
```

Todo terminal logico deve ter um terminal visual correspondente em `visual.terminals` com o mesmo `id`.

### `electricalModel`

Obrigatorio quando `simulation.effects` contem `electrical`.

```json
{
  "electricalModel": {
    "type": "sensor-module",
    "logicVoltage": 3.3,
    "toleratesFiveVoltPower": false,
    "bus": "i2c",
    "inputCurrentAmps": 0.001
  }
}
```

Esse bloco deve conter somente dados do modelo eletrico. Regras genericas pertencem ao solver; excecoes muito especificas devem ser justificadas.

### `behavior`

Obrigatorio para `microcontroller`, `behavioral-sensor` e `environment-source`.

```json
{
  "behavior": {
    "type": "bmp280-sensor",
    "environmentChannel": "climate",
    "bus": "i2c",
    "addressProperty": "i2cAddress",
    "sdaTerminal": "sda",
    "sclTerminal": "scl"
  }
}
```

`behavior.type` seleciona o adapter registrado em `simulation/behavior.js` ou em adapters core existentes. O manifest deve apontar canais, terminais, propriedades e barramentos; o adapter deve implementar apenas a logica que nao cabe no contrato declarativo.

### `contributions`

Declara arquivos carregados pelo core.

```json
{
  "contributions": {
    "wasmImports": {
      "modules": ["./firmware/wasm-imports.js"]
    },
    "simulationBehaviors": {
      "modules": ["./simulation/behavior.js"]
    },
    "styles": {
      "files": ["./ui/styles.css"]
    }
  }
}
```

Contribuicoes devem ser append-only sempre que possivel:

- `styles.files`: CSS visual especifico do componente.
- `simulationBehaviors.modules`: registro de behavior especializado.
- `wasmImports.modules`: imports WASM exigidos por bibliotecas do componente.

O caminho e resolvido a partir de `resources.baseUrl`, preenchido pelo carregador de componentes oficiais.

### `visual`

Define como o componente aparece no board e no catalogo.

```json
{
  "visual": {
    "type": "bmp280-sensor",
    "title": "BMP280",
    "className": "bmp280-sensor",
    "body": "25 C / 1013 hPa",
    "width": 170,
    "height": 118,
    "controls": [],
    "stateBindings": [],
    "palette": {
      "group": "Sensors",
      "subgroup": "Environment",
      "icon": "bmp280-icon",
      "order": 26
    },
    "terminals": [
      { "id": "vcc", "side": "left", "x": 0, "y": 26, "kind": "power" }
    ]
  }
}
```

Use `visual.controls` para elementos inline como sliders, checkboxes, selects, containers e readouts. Use `visual.stateBindings` para textos e classes derivados de sinais, nets, ambiente, propriedades ou leituras do runtime.

CSS especifico deve ficar em `ui/styles.css`; `apps/web/styles.css` deve conter layout, editor, board, inspector e estilos compartilhados.

## Firmware

Bibliotecas de firmware especificas de componente ficam em `firmware/library*.json`.

```json
{
  "id": "bmp280",
  "headers": ["BMP280"],
  "identifiers": ["BMP280"],
  "imports": ["bmp280Begin", "bmp280ReadTemperature", "bmp280ReadPressure"],
  "apis": ["BMP280.begin", "BMP280.readTemperature", "BMP280.readPressure"]
}
```

O resolver combina:

- `apps/web/firmware/core-libraries.json`, para Arduino core, Serial, Wire e SPI;
- `components/official/**/firmware/library*.json`, para bibliotecas adicionadas por componentes.

Shims C++ especificos ficam em `firmware/shims/*.cpp`. Shims genericos do Arduino ficam em `apps/web/firmware/shims/arduino-wasm/**`.

Imports WASM especificos ficam em `firmware/wasm-imports.js` e devem registrar imports apenas para as bibliotecas ou capacidades declaradas.

## Regras de Evolucao

- Adicionar componente novo deve ser majoritariamente append-only dentro de `components/official/<slug>/`.
- Editar core e aceitavel quando o projeto ganha uma capacidade generica nova, como um tipo de barramento, primitive eletrica, formato de binding ou API Arduino core.
- Editar `arduino-runtime.js` deve significar comportamento runtime generico, nao regra visual de componente.
- Editar `wasm-import-adapters.js` deve significar import Arduino/core reutilizavel, nao import especifico de biblioteca externa.
- Editar `wasm-compiler.mjs` ou `clang-analyzer.mjs` deve ser excecao ligada a toolchain, descoberta de libraries, diagnostico ou montagem de shims.

## Checklist Rapido

- `component.json` e valido e aponta para `schemas/component.schema.json`.
- `simulation` declara papel, efeitos e `implemented`.
- `terminals` e `visual.terminals` possuem os mesmos IDs.
- `properties` tem defaults e `simulationUpdate` quando afeta runtime.
- `visual.palette` existe se o componente aparece no catalogo.
- CSS especifico fica em `ui/styles.css` e e declarado em `contributions.styles`.
- Bibliotecas especificas ficam em `firmware/library*.json`.
- Shims especificos ficam em `firmware/shims/*.cpp`.
- Behaviors especificos ficam em `simulation/behavior.js`.
- Exemplo oficial em `examples/<slug>/project.json` cobre o caminho principal.
- Testes relevantes passam.

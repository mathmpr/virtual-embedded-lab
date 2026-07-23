# Guia para Novos Componentes Oficiais

Leia este guia antes de qualquer documento em `add-components/`. Ele define as regras arquiteturais mínimas para evitar que novos componentes voltem a acoplar lógica específica no editor, no runtime ou no compilador central.

Para o formato completo de um componente, leia também `docs/component-description.md`.

## Regra Principal

Um componente novo deve ser descrito por manifest em `components/official/<slug>/component.json`. Arquivos auxiliares ficam dentro da mesma pasta do componente: `ui/styles.css`, `simulation/behavior.js`, `firmware/library*.json`, `firmware/wasm-imports.js` e `firmware/shims/*.cpp`.

Código específico só é aceitável quando houver comportamento físico, elétrico, firmware ou adapter realmente novo. A adição de componentes deve ser append-only sempre que possível.

Não adicione lógica do tipo:

```js
if (component.type === "novo-componente") {
  // propriedade, visual ou sinal simples
}
```

Para propriedades simples, UI, terminais, sinais e estados visuais, use manifest.

## Checklist Obrigatório

- [ ] O componente não adiciona `if (component.type === "novo-componente")` no editor para propriedades simples.
- [ ] O componente usa propriedades declaradas em `properties` e `propertySchema`.
- [ ] O componente declara terminais lógicos em `terminals`.
- [ ] O componente mantém `visual.terminals` com os mesmos IDs de `terminals`.
- [ ] O componente declara `simulation.kind`, `simulation.effects` e `simulation.implemented`.
- [ ] O componente declara `behavior` quando participa do runtime, ambiente, firmware ou barramentos.
- [ ] O componente declara `electricalModel` quando participa do solver elétrico.
- [ ] CSS específico do componente fica em `components/official/<slug>/ui/styles.css` e é declarado em `contributions.styles`.
- [ ] Bibliotecas de firmware específicas ficam em `components/official/<slug>/firmware/library*.json`.
- [ ] Shims C++ específicos ficam em `components/official/<slug>/firmware/shims/*.cpp`.
- [ ] Imports WASM específicos ficam em `components/official/<slug>/firmware/wasm-imports.js`.
- [ ] Behaviors especializados ficam em `components/official/<slug>/simulation/behavior.js`.
- [ ] O componente usa `visual.controls` para controles inline no board.
- [ ] O componente usa `visual.stateBindings` para estados visuais derivados.
- [ ] Código específico novo fica em adapter/registry, não misturado no editor.
- [ ] APIs novas de firmware entram via registry de shims/imports, não diretamente no compilador/runner central.
- [ ] O exemplo oficial roda pelo caminho WASM, sem depender da IR JS depreciada.
- [ ] Testes cobrem manifest, exemplo, propriedades, behavior, solver ou firmware conforme o escopo.

## Onde Declarar Cada Coisa

- `properties`: valores editáveis e estado persistido do componente.
- `variants`: opções conhecidas para propriedades como resistores, capacitores e faixas fixas.
- `terminals`: pontos conectáveis usados por grafo, solver, firmware e serialização.
- `visual.controls`: controles inline renderizados genericamente no board.
- `visual.stateBindings`: classes e textos derivados de sinais, nets, ambiente ou leituras elétricas.
- `contributions.styles`: CSS visual específico carregado a partir da pasta do componente.
- `contributions.wasmImports`: módulos JS que registram imports WASM específicos.
- `contributions.simulationBehaviors`: módulos JS que registram behaviors específicos.
- `simulation`: papel do componente dentro da simulação.
- `behavior`: runtime, pinos, barramentos, canais ambientais e adapters especializados.
- `electricalModel`: primitivas elétricas, limites e validações do solver.

## Quando Criar Código Específico

Crie adapter específico apenas quando o componente introduzir comportamento novo.

Casos válidos:

- Sensor que converte ambiente em leitura de firmware, como HC-SR04, FC-37, LDR ou BMP280.
- Conversor/barramento que exige protocolo, como ADS1115 por I2C ou MCP3008 por SPI.
- Biblioteca de firmware nova, como `WiFi.h`, `AsyncMqttClient.h` ou bibliotecas de sensores.
- Modelo elétrico novo que não pode ser representado por primitivas existentes.

Casos inválidos:

- Renderizar propriedade simples no inspector.
- Adicionar slider, checkbox ou select inline.
- Mostrar texto ON/OFF, valor numérico ou badge de estado.
- Descobrir pino por regex ou por nome fixo quando o manifest já declara capacidade.

## Fluxo Recomendado

1. Escrever ou atualizar o documento em `add-components/` usando `add-components/new-component-example.md`.
2. Declarar manifest em `components/official/<slug>/component.json`.
3. Adicionar `ui/`, `simulation/` e `firmware/` dentro do componente somente quando necessário.
4. Criar exemplo em `examples/<slug>/project.json`.
5. Registrar behavior, electrical primitive, import WASM ou shim somente se necessário.
6. Adicionar/ajustar testes de fixtures e simulação conforme o escopo.
7. Rodar `npm test`.

## Relação com Outros Documentos

- Use `docs/component-contract.md` como contrato técnico do manifest.
- Use `docs/component-description.md` como guia prático da estrutura de um componente.
- Use `docs/wasm-firmware-libraries.md` para APIs de firmware suportadas.
- Use `docs/hardcoded-coupling-map.md` apenas como histórico/TODO de remoção de acoplamentos.

# Contrato de Componentes Oficiais

Antes de implementar um componente oficial, leia também `docs/official-component-guidelines.md` e `docs/component-description.md`. Este arquivo define o contrato técnico do manifest; os outros guias definem as regras arquiteturais e a estrutura prática do pacote de componente.

Todo componente oficial fica em `components/official/**/component.json` e deve declarar, no mínimo:

- `identity`: identificador estável, nome, categoria e subcategoria opcional.
- `simulation`: classificação explícita do papel do componente na simulação.
- `terminals`: terminais lógicos usados por conexões, solver e serialização.
- `visual`: representação visual e, quando o componente aparece no catálogo, `visual.palette`.

## `simulation`

O bloco `simulation` evita inferência por nome/categoria e separa componentes visuais, passivos e comportamentais.

Campos obrigatórios:

- `kind`: um de `visual-only`, `passive-electrical`, `active-electrical`, `behavioral-sensor`, `environment-source` ou `microcontroller`.
- `effects`: lista com `electrical`, `firmware`, `environment` e/ou `visual-state`.
- `implemented`: indica se o comportamento descrito já é suportado pelo simulador atual.

Regras atuais:

- Componentes com `effects` contendo `electrical` devem declarar `electricalModel`.
- Componentes `microcontroller`, `behavioral-sensor` e `environment-source` devem declarar `behavior`.
- Componentes com `visual.palette` devem aparecer no catálogo carregado pela UI.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

## Categorias Práticas

- `passive-electrical`: resistor, capacitor e outros passivos com modelo elétrico.
- `active-electrical`: LED e semicondutores com estado visual derivado do solver.
- `behavioral-sensor`: sensores que interagem com firmware/runtime, como HC-SR04.
- `environment-source`: controles ambientais, como distância e Wi-Fi Signal.
- `microcontroller`: placas que executam firmware e expõem GPIO/periféricos.

## Testes

Os invariantes do catálogo ficam em `tests/fixtures/json-files.test.ts`. Eles validam o contrato mínimo, presença na palette e consistência entre terminais visuais e lógicos.

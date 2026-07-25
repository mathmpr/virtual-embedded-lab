# Contributing to Virtual Embedded Lab

Obrigado pelo interesse em contribuir.

Este projeto é open source sob AGPLv3-or-later. Ao contribuir, você concorda que sua contribuição seja distribuída sob a mesma licença do projeto.

## Como rodar localmente

```bash
npm install
npm run dev
```

A aplicação roda por padrão em:

```text
http://127.0.0.1:4173
```

## Como validar mudanças

Antes de enviar alterações, rode:

```bash
npm test
```

## Diretrizes gerais

- Preserve o fluxo local-first: o projeto deve continuar funcionando bem clonado do Git e executado localmente.
- Evite acoplamento novo no core quando um componente puder ser descrito por manifesto, contribuição local ou behavior próprio.
- Novos componentes oficiais devem seguir:
  - `docs/official-component-guidelines.md`
  - `docs/component-description.md`
  - `docs/component-contract.md`
  - `add-components/new-component-example.md`
- Exemplos em `examples/**/project.json` devem ter descrição em `description` e versões em `descriptionI18n.pt-BR`, `descriptionI18n.en` e `descriptionI18n.es`.
- Mudanças de UI devem manter o padrão visual existente e incluir teste quando houver risco de regressão.
- Mudanças de simulação elétrica devem preferir diagnósticos explicáveis e didáticos.

## Relatando bugs

Ao abrir uma issue, inclua:

- sistema operacional;
- versão do Node.js;
- navegador;
- exemplo/projeto usado;
- passos para reproduzir;
- comportamento esperado;
- comportamento observado;
- mensagens do painel Problemas/Console, quando existirem.

## Pull requests

Um PR deve conter:

- descrição objetiva da mudança;
- motivação;
- screenshots ou gravações curtas para mudanças visuais relevantes;
- testes executados;
- limitações conhecidas, se houver.

## Licença e marca

O código é licenciado sob AGPLv3-or-later. Se você modificar o projeto e oferecer uma versão pela rede, a AGPL exige que o código-fonte correspondente também seja disponibilizado aos usuários desse serviço.

O nome "Virtual Embedded Lab", logo e identidade visual não devem ser usados para apresentar forks, hospedagens ou distribuições não oficiais como se fossem o projeto oficial. Use atribuição clara quando redistribuir ou modificar.


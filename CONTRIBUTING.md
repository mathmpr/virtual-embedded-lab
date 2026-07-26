# Contributing to Virtual Embedded Lab

Thank you for your interest in contributing.

This project is open source under `AGPL-3.0-or-later`. By contributing, you agree that your contribution is distributed under the same license.

## Running locally

```bash
npm install
npm run dev
```

The application runs at:

```text
http://127.0.0.1:4173
```

## Validating changes

Before submitting changes, run:

```bash
npm test
```

## General guidelines

- Preserve the local-first workflow: the project should keep working when cloned from Git and run locally.
- Avoid adding new coupling to the core when a component can be described through its manifest, local contributions, or its own behavior module.
- New official components must follow:
  - `docs/official-component-guidelines.md`
  - `docs/component-description.md`
  - `docs/component-contract.md`
  - `add-components/new-component-example.md`
- Examples in `examples/**/project.json` must provide `description` and translated descriptions in `descriptionI18n.pt-BR`, `descriptionI18n.en`, and `descriptionI18n.es`.
- UI changes should preserve the current visual standard and include tests when there is regression risk.
- Electrical simulation changes should prefer clear, educational diagnostics.

## Reporting bugs

When opening an issue, include:

- operating system;
- Node.js version;
- browser;
- example/project used;
- steps to reproduce;
- expected behavior;
- observed behavior;
- messages from the Problems/Console panels, when available.

## Pull requests

A pull request should include:

- objective description of the change;
- motivation;
- screenshots or short recordings for relevant visual changes;
- tests executed;
- known limitations, when applicable.

## License and trademark

The code is licensed under `AGPL-3.0-or-later`. If you modify the project and offer that modified version over a network, the AGPL requires the corresponding source code to be made available to users of that service.

The name "Virtual Embedded Lab", logo, and visual identity must not be used to present forks, hosted versions, or unofficial distributions as the official project. Use clear attribution when redistributing or modifying the project.

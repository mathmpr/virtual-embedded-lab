# Architecture

This document describes the current architecture of Virtual Embedded Lab.

## Main layers

- `apps/web`: local web UI, board editor, simulation UI, and Node server.
- `components/official`: official component packages. Each package owns its manifest and optional local contributions.
- `examples`: project examples consumed by the Examples modal.
- `schemas`: JSON schemas for projects and components.
- `packages/project-model`: shared project-model types.
- `tests`: validation for schemas, catalog, UI, simulation, firmware, and server behavior.

## Local server

`apps/web/server.mjs` serves the web UI and local APIs:

- `GET /api/components`: official component catalog.
- `GET /api/examples`: example catalog.
- `GET /api/examples/:id`: example project with firmware file references resolved.
- `POST /api/firmware/compile-wasm`: creates a WASM compilation job.
- `GET /api/firmware/compile-wasm/:jobId`: polls the compilation job.
- `POST /api/shared-projects`: creates a public local share under `shared/<id>/project.json`.
- `GET/PUT /api/shared-projects/:id`: loads or updates a shared project.
- `POST /api/network/mqtt/*`: MQTT bridge used by real-MQTT examples.

The server binds to `127.0.0.1:4173` by default.

## Firmware

The primary firmware path is WASM:

1. User code is submitted to the server.
2. The server wraps it with Arduino-compatible shim code.
3. `clang++` compiles the source to `wasm32`.
4. The browser/Node runtime instantiates the WASM module.
5. WASM imports call into `ArduinoRuntime`.

The legacy JavaScript IR still exists for tests and historical compatibility, but it is no longer the runtime path used by the UI and should not receive new features.

## WASM firmware compilation

`apps/web/firmware/wasm-compiler.mjs` is responsible for:

- resolving supported firmware libraries;
- stripping supported includes;
- rejecting unsupported includes before calling Clang;
- generating Arduino shim source;
- compiling to freestanding WASM;
- exporting `__vl_setup`, `__vl_loop`, `memory`, and pin constants;
- caching successful builds by source/toolchain/sandbox hash.

Compilation can run in three modes:

- `none`: local development, calls `clang++` directly.
- `docker`/`podman`: container sandbox with no network, CPU/memory/PID limits.
- `external`: calls a configured runner, used by hardened deployments to delegate compilation to a separate unprivileged user.

The public server should also enforce source-size limits and rate limits at the HTTP endpoint.

## Components and contributions

Official components are package-like folders under `components/official/<component>/`.

A component can provide:

- `component.json`: manifest and source of truth.
- `ui/*.css`: optional UI styles.
- `simulation/*.js`: optional simulation behavior.
- `firmware/*.mjs`: optional WASM imports, C++ shims, and supported firmware libraries.

The core loads contributions declared in the manifest through:

- `contributions.styles`;
- `contributions.simulationBehaviors`;
- `contributions.wasmImports`.

The goal is to keep component-specific logic inside the component package, not hardcoded in the core.

## Simulation

The simulation is built from:

- `VirtualClock`: deterministic virtual time.
- `EventScheduler`: deterministic scheduling by virtual time.
- `EnvironmentEngine`: environment channels such as distance, light, rain, climate, Wi-Fi, and analog voltage.
- `ArduinoRuntime`: Arduino-compatible runtime APIs called by WASM imports.
- `CircuitGraph`: graph derived from board nets.
- `electrical-solver`: incremental educational electrical diagnostics.
- component behavior modules: sensor, display, actuator, and environment binders.

The simulator favors explainable educational diagnostics over full SPICE accuracy.

## Project model

Projects are stored as JSON. A project contains:

- components and positions;
- properties;
- electrical connections;
- environment connections;
- wire colors;
- one or more firmware files;
- optional network configuration;
- optional share key.

Electrical and environment connections are serialized separately, even though the editor still renders environment links as visual wires.

## Examples with external services

Some examples are fully deterministic. Others intentionally depend on external services:

- `ESP Water Control Pump Reservoir` can use a real MQTT bridge compatible with `https://github.com/mathmpr/water-control`.

External examples must document their dependency and remain clearly separated from deterministic local examples.

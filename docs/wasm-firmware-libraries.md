# WASM Firmware Libraries

This document lists firmware libraries supported by the WASM path and the rules for extending them.

## Supported libraries

Supported libraries are registered by `apps/web/firmware/wasm-shim-registry.mjs` and by component-local firmware contributions.

Current examples use minimal shims for:

- Arduino core APIs used by the runtime.
- `WiFi` / `WiFiClient`.
- `AsyncMqttClient`.
- `SimpleTimer`.
- `Wire`.
- `SPI`.
- `BMP280`.
- `ADS1015`.
- `ADS1115`.
- `MCP3008`.
- Servo support.
- LCD/display helpers when declared by component contributions.

These are intentionally small compatibility layers, not full upstream library ports.

## Extension rule

Add only the API surface required by an example or component. Keep unsupported calls explicit and diagnostic-friendly.

When a library belongs to a specific component, prefer placing the shim/import contribution in that component package instead of hardcoding it in the core.

## Virtual HTTP network

`WiFiClient` can talk to a deterministic virtual HTTP adapter. Routes are declared in project JSON under `network.http`.

The virtual adapter supports common request/response scenarios used by examples, including:

- method;
- host;
- path;
- query;
- request body;
- response status;
- response headers;
- response body.

This is not real TLS/HTTPS networking. It is a deterministic simulation adapter.

## Virtual and real MQTT

`AsyncMqttClient` supports:

- a virtual broker declared in `network.mqtt`;
- a real MQTT bridge through the Node backend when `network.mqtt.mode` is `"real"`.

The virtual broker is deterministic and suitable for examples. The real bridge is intentionally scoped to controlled demos and should document external dependencies.

Not included yet:

- full QoS semantics;
- persistent retained messages;
- durable sessions;
- TLS/authentication as part of the deterministic simulator.

## External example: water-control

The `ESP Water Control Pump Reservoir` example can use a real broker/backend compatible with:

```text
https://github.com/mathmpr/water-control
```

That mode requires valid tokens, expected topics/payloads, and a reachable MQTT TCP broker.

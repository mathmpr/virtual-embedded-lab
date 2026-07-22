# Bibliotecas de firmware WASM

O caminho principal de execução de firmware é WASM. A IR JavaScript é legado para testes/debug temporário e não deve receber novas APIs.

## Bibliotecas suportadas

- `Arduino` / core: `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `delay`, `delayMicroseconds`, `pulseIn`, `millis`, `micros`.
- `Serial`: `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.write`, `Serial.available`, `Serial.read`.
- `Wire`: `Wire.begin`, `Wire.beginTransmission`, `Wire.write`, `Wire.endTransmission`, `Wire.requestFrom`, `Wire.available`, `Wire.read`.
- `SPI`: `SPI.begin`, `SPI.transfer`.
- `WiFi`: `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.internetAvailable`.
- `BMP280`: `BMP280.begin`, `BMP280.readTemperature`, `BMP280.readPressure`.
- `ADS1015` / `ADS1115`: `begin`, `readADC_SingleEnded`, `computeVolts`.
- `MCP3008`: `begin`, `read`.

## Regra de extensão

Novas bibliotecas devem ser adicionadas no registry de shims/imports, não diretamente no compiler ou no runner central:

- Compiler: `apps/web/firmware/wasm-shim-registry.mjs`.
- Runner: `apps/web/js/simulation/wasm-import-adapters.js`.

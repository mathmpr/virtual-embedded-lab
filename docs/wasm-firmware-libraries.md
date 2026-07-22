# Bibliotecas de firmware WASM

O caminho principal de execução de firmware é WASM. A IR JavaScript é legado para testes/debug temporário e não deve receber novas APIs.

## Bibliotecas suportadas

- `Arduino` / core: `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `delay`, `delayMicroseconds`, `pulseIn`, `millis`, `micros`.
- `Serial`: `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.write`, `Serial.available`, `Serial.read`.
- `Wire`: `Wire.begin`, `Wire.beginTransmission`, `Wire.write`, `Wire.endTransmission`, `Wire.requestFrom`, `Wire.available`, `Wire.read`.
- `SPI`: `SPI.begin`, `SPI.transfer`.
- `WiFi`: `WiFi.mode`, `WiFi.begin`, `WiFi.status`, `WiFi.softAP`, `WiFi.scanNetworks`, `WiFi.RSSI`, `WiFi.internetAvailable`.
- `WiFiClient`: `connect`, `print`, `println`, `available`, `read`, `stop`, `connected`.
- `ESP8266WiFi`: alias compatível com o shim `WiFi`, incluindo `WiFi.disconnect`, `WiFi.setAutoReconnect`, `WiFi.persistent`, `WiFi.scanDelete` e `WiFi.SSID`.
- `AsyncMqttClient`: `setServer`, `onConnect`, `onDisconnect`, `onMessage`, `connect`, `disconnect`, `connected`, `subscribe`, `publish`.
- `SimpleTimer`: `setInterval`, `run`.
- `BMP280`: `BMP280.begin`, `BMP280.readTemperature`, `BMP280.readPressure`.
- `ADS1015` / `ADS1115`: `begin`, `readADC_SingleEnded`, `computeVolts`.
- `MCP3008`: `begin`, `read`.

## Regra de extensão

Novas bibliotecas devem ser adicionadas no registry de shims/imports, não diretamente no compiler ou no runner central:

- Compiler: `apps/web/firmware/wasm-shim-registry.mjs`.
- Runner: `apps/web/js/simulation/wasm-import-adapters.js`.

## Rede HTTP virtual

`WiFiClient` roda dentro do runtime virtual e exige que o componente Wi-Fi Signal esteja conectado e com internet ativa. A etapa atual modela sockets TCP e respostas HTTP virtuais para cenários suportados, como `jsonplaceholder.typicode.com/todos/1`.

O HTTP foi isolado em `apps/web/js/simulation/virtual-http-server.js`. O parser reconhece linha de request, headers case-insensitive com múltiplos valores, query string, body com `Content-Length` e request body com `Transfer-Encoding: chunked` básico.

Métodos suportados: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` e `HEAD`. `HEAD` reutiliza rotas `GET` sem enviar body. `OPTIONS` pode ser respondido automaticamente a partir das rotas registradas.

Rotas podem ser declaradas no `project.json`:

```json
"network": {
  "http": {
    "hosts": {
      "api.local": {
        "routes": [
          {
            "method": "GET",
            "path": "/status",
            "statusCode": 200,
            "body": { "ok": true }
          }
        ]
      }
    }
  }
}
```

TLS/HTTPS real ainda deve entrar como biblioteca/adapter próprio, sem expandir a IR JS depreciada. MQTT externo já existe pelo bridge backend Node, porque o browser/WASM não abre sockets TCP MQTT diretamente.

## MQTT virtual e real

`AsyncMqttClient` pode rodar contra dois backends:

- Broker virtual determinístico em `apps/web/js/simulation/virtual-mqtt-broker.js`.
- Broker real via `apps/web/network/mqtt-bridge.mjs`, usando o pacote Node `mqtt`.

O broker virtual suporta conexão, desconexão, `subscribe`, `publish`, tópicos com curingas `+` e `#`, mensagens iniciais declaradas no projeto e snapshot dos publishes realizados pelo firmware.

O broker real é ativado com `network.mqtt.mode: "real"`. Nesse modo, o firmware WASM chama imports síncronos, o `ArduinoRuntime` encaminha as operações para `/api/network/mqtt/*`, e o backend mantém a conexão TCP MQTT real. Esse caminho permite publicar em brokers da rede local, como `192.168.200.70:1883`.

Cada runtime de microcontrolador usa um `clientId` derivado do componente no board. Em projetos multi-board, isso permite que ESP32 e ESP8266 mantenham conexões, subscriptions e filas de mensagens separadas mesmo usando o mesmo broker. O bridge entrega mensagens recebidas por drain ordenado, uma mensagem por chamada, e o shim `AsyncMqttClient` drena múltiplas mensagens por poll para preservar comandos consecutivos como `toggle/water = 1` seguido de `toggle/water = 0`.

`SimpleTimer` usa o `millis()` virtual do firmware. Timers periódicos disparam quando o sketch chama `timer.run()` no `loop()` e o tempo virtual avança por APIs como `delay()`. Isso permite modelar keepalive MQTT com intervalos reais, como `keepAliveTimer.setInterval(8300, publishKeepAlive)`.

Broker e mensagens iniciais podem ser declarados no `project.json`:

```json
"network": {
  "mqtt": {
    "mode": "virtual",
    "brokers": {
      "mqtt.local": {
        "port": 1883,
        "online": true,
        "messages": [
          { "topic": "toggle/water", "payload": "1" }
        ]
      }
    }
  }
}
```

Para broker real:

```json
"network": {
  "mqtt": {
    "mode": "real",
    "brokers": {
      "192.168.200.70": {
        "port": 1883,
        "online": true
      }
    }
  }
}
```

Limite atual: o bridge MQTT real ainda cobre conexão, `subscribe`, `publish` e drain de mensagens recebidas. Ele não implementa autenticação/TLS, QoS completo, retained messages persistentes ou sessões duráveis.

## Exemplo externo: water-control

`examples/esp-water-control-pump-reservoir/project.json` é um exemplo de integração com broker/backend real. Ele foi escrito para o contrato MQTT do projeto externo `https://github.com/mathmpr/water-control`.

Regras importantes desse exemplo:

- o ESP8266 `asker` e o ESP32 `sender` usam tokens diferentes;
- o backend externo identifica o usuário pelo token no início do payload, não apenas pelo campo `iam`;
- se o ESP32 publicar `detect/water` com token do `asker`, o backend interpreta o evento como `asker` e pode não republicar `toggle/water`;
- os firmwares do exemplo possuem comentários apontando para o repositório externo porque tópicos, payloads e tokens precisam bater com aquele backend.

Esse contrato externo é opcional para o simulador. Projetos que não precisam conversar com um broker real devem preferir o broker virtual em `network.mqtt`.

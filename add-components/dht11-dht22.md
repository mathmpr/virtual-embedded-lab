# Add Component: DHT11/DHT22

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, behaviors e adapters, sem lógica específica no editor/runtime central.

## Objetivo

Adicionar sensores DHT11 e DHT22 para temperatura e umidade.

- Componentes a adicionar: DHT11 e DHT22, preferencialmente com manifest compartilhável por variantes.
- Cenário principal de uso: Arduino/ESP lê temperatura/umidade e imprime no Serial.
- Exemplo final esperado: Arduino UNO com DHT22 alimentado por Climate/Humidity Environment.
- O componente afeta a simulação: sim, por firmware, ambiente e estado visual.
- O exemplo precisa rodar em WASM: sim.

## Componentes

### DHT11

- `identity.id`: `sensor.temperature-humidity.dht11`.
- `identity.name`: `DHT11`.
- `identity.category`: `sensor`.
- `identity.subCategory`: `climate`.
- Caminho esperado: `components/official/dht11/component.json`.

### DHT22

- `identity.id`: `sensor.temperature-humidity.dht22`.
- `identity.name`: `DHT22`.
- `identity.category`: `sensor`.
- `identity.subCategory`: `climate`.
- Caminho esperado: `components/official/dht22/component.json`.

## Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `environment`, `visual-state`, `electrical`.
- `simulation.implemented`: `true` quando shim `DHT` e ambiente de umidade estiverem prontos.

## Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 30 | power |
| `data` | DATA | `digital-io` | right | 150 | 54 | signal |
| `gnd` | GND | `ground` | bottom | 76 | 108 | ground |
| `env` | ENV | `environment-input` | right | 150 | 84 | environment |

## Propriedades e Controles

| property | type | default | min | max | unit | simulationUpdate | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `temperatureCelsius` | number | 25 | -40 | 80 | `C` | `live` | sim |
| `humidityPercent` | number | 55 | 0 | 100 | `%` | `live` | sim |
| `sensorModel` | string | `DHT22` |  |  |  | `rerun` | nao |
| `readIntervalMs` | number | 2000 | 1000 | 10000 | `ms` | `rerun` | sim |

Diferenças esperadas:

- DHT11: menor precisão, faixa mais limitada.
- DHT22: maior precisão, faixa maior.

## Modelo Elétrico

- `electricalModel.type`: `sensor-module`.
- Tensão recomendada: 3.3 V a 5 V.
- Corrente aproximada: 2.5 mA em leitura.
- Diagnósticos esperados: DATA flutuante sem pull-up quando o solver suportar, VCC/GND ausente e pino sem capacidade digital.

## Comportamento Simulado

- O componente consome canal ambiental de clima/umidade.
- `readTemperature()` retorna temperatura atual.
- `readHumidity()` retorna umidade atual.
- O protocolo single-wire real pode ser abstraído pelo shim da biblioteca `DHT`.

## Firmware/WASM

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim | observação |
| --- | --- | --- | --- | --- |
| `#include <DHT.h>` | sim | sim | DHT | biblioteca nova |
| `DHT dht(pin, type)` | sim | sim | DHT | construtor |
| `dht.begin()` | sim | sim | DHT | inicializa |
| `dht.readTemperature()` | sim | sim | DHT | retorna ambiente |
| `dht.readHumidity()` | sim | sim | DHT | retorna ambiente |
| `isnan(value)` | sim | sim | C/math shim | muitos exemplos usam |

## Exemplo Obrigatório

##### `examples/arduino-dht22-climate/project.json`

- Componentes: Arduino UNO, DHT22 e Climate/Humidity Environment.
- Conexões: `D2 -> DATA`, `5V -> VCC`, `GND -> GND`, ambiente no `env`.
- Código: imprime temperatura e umidade a cada 2s.

## Fora de Escopo

- Protocolo bit-level DHT real.
- Checksum temporal realista.
- Erros aleatórios de leitura.
- Condensação ou resposta térmica lenta.

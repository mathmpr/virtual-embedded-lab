# Componentes maker básicos de entrada e sensores

Baseado em `componentes_maker_para_criancas.md`. Este pacote adiciona componentes ausentes frequentes em kits educacionais sem expandir o core com comportamentos específicos desnecessários.

## Objetivo

- Componentes adicionados: potenciômetro 10 kΩ, trimpot 10 kΩ, chave deslizante, TTP223, PIR HC-SR501, tilt switch, SW-420, A3144 Hall, reed switch, sensor IR de obstáculo, LM35 e sensor capacitivo de umidade do solo.
- Cenário principal de uso: aulas introdutórias com `analogRead`, `digitalRead`, entradas com sliders/checks e diagnósticos visuais simples.
- Exemplos finais:
  - `examples/arduino-maker-analog-inputs/project.json`
  - `examples/arduino-maker-digital-sensors/project.json`
- Os exemplos rodam em WASM usando APIs Arduino já suportadas.

## Componentes

### Entradas analógicas

| Componente | `identity.id` | Caminho | Simulação |
| --- | --- | --- | --- |
| Potentiometer 10 kΩ | `input.analog.potentiometer.10k` | `components/official/potentiometer-10k/component.json` | `analog-voltage-source` |
| Trimpot 10 kΩ | `input.analog.trimpot.10k` | `components/official/trimpot-10k/component.json` | `analog-voltage-source` |
| LM35 Temperature Sensor | `sensor.temperature.lm35` | `components/official/lm35-temperature-sensor/component.json` | `analog-voltage-source` |
| Capacitive Soil Moisture Sensor | `sensor.soil-moisture.capacitive` | `components/official/capacitive-soil-moisture-sensor/component.json` | `analog-voltage-source` |

Observação: estes componentes reutilizam o behavior genérico `analog-voltage-source`. O usuário ajusta `voltageVolts` no board/inspector, e o firmware converte a leitura conforme o componente. Isso mantém a simulação determinística sem criar conversões hardcoded no core.

### Entradas digitais

| Componente | `identity.id` | Caminho | Simulação |
| --- | --- | --- | --- |
| Slide Switch | `input.switch.slide` | `components/official/slide-switch/component.json` | `momentary-button` com checkbox |
| TTP223 Capacitive Touch | `input.touch.ttp223` | `components/official/ttp223-touch-sensor/component.json` | `momentary-button` com pulso |
| PIR HC-SR501 Motion Sensor | `sensor.motion.pir.hc-sr501` | `components/official/pir-hc-sr501/component.json` | `momentary-button` com checkbox |
| Tilt Switch | `sensor.position.tilt-switch` | `components/official/tilt-switch/component.json` | `momentary-button` com checkbox |
| SW-420 Vibration Sensor | `sensor.vibration.sw420` | `components/official/vibration-sw420/component.json` | `momentary-button` com pulso |
| A3144 Hall Sensor | `sensor.magnetic.hall.a3144` | `components/official/hall-a3144/component.json` | `momentary-button` com checkbox |
| Reed Switch | `sensor.magnetic.reed-switch` | `components/official/reed-switch/component.json` | `momentary-button` com checkbox |
| IR Obstacle Sensor | `sensor.obstacle.ir` | `components/official/ir-obstacle-sensor/component.json` | `momentary-button` com checkbox |

Observação: o behavior `momentary-button` já dirige entradas digitais do runtime por terminal conectado. Os nomes dos componentes representam sensores maker reais, mas a entrada ambiental/física é controlada no próprio componente para manter a UI simples.

## Terminais

Os componentes analógicos usam:

| id | type | kind |
| --- | --- | --- |
| `vcc` | `power-input` | `power` |
| `wiper`/`out` | `analog-output` | `signal` |
| `gnd` | `ground` | `ground` |

Os componentes digitais usam:

| id | type | kind |
| --- | --- | --- |
| `vcc` | `power-input` | `power` |
| `out` | `digital-output` | `signal` |
| `gnd` | `ground` | `ground` |

## Firmware/WASM

APIs usadas pelos exemplos:

| API | precisa compilar? | precisa simular comportamento? | biblioteca/shim |
| --- | --- | --- | --- |
| `pinMode` | sim | sim | Arduino core |
| `analogRead` | sim | sim | Arduino core + analog source |
| `digitalRead` | sim | sim | Arduino core + momentary-button |
| `digitalWrite` | sim | sim | Arduino core |
| `Serial.print`/`Serial.println` | sim | sim | Serial |
| `delay` | sim | sim | Arduino core |

## Exemplos

### Arduino Maker Analog Inputs

- Componentes: Arduino UNO, potenciômetro 10 kΩ, LM35 e sensor capacitivo de umidade do solo.
- Conexões: A0 no potenciômetro, A1 no LM35, A2 no sensor de solo.
- Firmware: `examples/arduino-maker-analog-inputs/firmware/main.ino`.
- Resultado: Serial mostra raw/voltagem do potenciômetro, temperatura calculada do LM35 e raw/voltagem do sensor de solo.

### Arduino Maker Digital Sensors

- Componentes: Arduino UNO, PIR, TTP223, tilt, SW-420, Hall, reed, IR obstáculo e chave deslizante.
- Conexões: D2-D9 para as saídas digitais.
- Firmware: `examples/arduino-maker-digital-sensors/firmware/main.ino`.
- Resultado: Serial mostra ON/OFF de cada sensor e o LED built-in acende quando qualquer entrada está ativa.

## Fora de Escopo

- Modelos físicos detalhados de PIR, efeito Hall, reflexão IR, vibração e umidade do solo.
- Conversões automáticas de temperatura/umidade para tensão no core.
- Bibliotecas específicas de sensores; os exemplos usam apenas Arduino core.
- Sensores e atuadores mais complexos da lista, como RFID, Bluetooth, motores DC/stepper, drivers, OLED gráfico e IMUs. Estes devem entrar em pacotes próprios quando houver contrato de simulação claro.

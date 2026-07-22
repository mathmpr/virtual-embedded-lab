# Add Components: BMP280 Pressure and Temperature Sensor

## Objetivo

Adicionar suporte ao sensor BMP280 para pressão barométrica e temperatura, junto de uma fonte ambiental standalone para clima. O sensor deve poder ser ligado por I2C a um microcontrolador e lido por firmware, refletindo mudanças de temperatura e pressão sem reiniciar a simulação.

- Componentes a adicionar: BMP280 Pressure/Temperature Sensor e Climate Environment.
- Cenário principal de uso: Arduino/ESP32 lê temperatura e pressão por I2C e imprime os valores no Serial.
- Exemplo final esperado: board com microcontrolador, BMP280, ambiente climático e `main.ino` imprimindo `Temperature C` e `Pressure hPa`.
- O componente deve afetar a simulação: sim, por ambiente, firmware, barramento I2C e estado visual.

## Componentes

### BMP280 Pressure/Temperature Sensor

#### Identidade

- `identity.id`: `sensor.environment.bmp280`.
- `identity.name`: `BMP280 Pressure/Temperature`.
- `identity.category`: `sensor`.
- `identity.subCategory`: `pressure-temperature`.
- Caminho esperado: `components/official/bmp280/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `environment`, `electrical`, `visual-state`.
- `simulation.implemented`: `true` se o caminho I2C/WASM for implementado nesta entrega.
- Observações: o BMP280 deve validar o modelo de sensores por barramento. Ele não deve ser implementado como leitura hardcoded por exemplo.

Regras:

- Deve declarar `behavior`, porque converte ambiente climático em leituras de firmware.
- Deve declarar `electricalModel`, porque depende de alimentação e nível lógico I2C.
- Deve aparecer em `Sensors/Environment` ou `Sensors/Pressure`.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

#### Terminais

Opção inicial recomendada: módulo BMP280 por I2C.

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vcc` | VCC | `power-input` | left | 0 | 26 | power |
| `gnd` | GND | `ground` | bottom | 82 | 118 | ground |
| `scl` | SCL | `i2c-scl` | right | 170 | 44 | signal |
| `sda` | SDA | `i2c-sda` | right | 170 | 72 | signal |
| `csb` | CSB | `spi-cs` | top | 70 | 0 | signal |
| `sdo` | SDO | `spi-miso` | top | 112 | 0 | signal |

Notas:

- Primeira entrega deve usar I2C por `VCC`, `GND`, `SCL` e `SDA`.
- `CSB` e `SDO` podem aparecer no manifest para fidelidade do módulo, mas SPI fica fora da primeira entrega.
- Endereço I2C padrão recomendado: `0x76`, com variante `0x77` quando `SDO` está em HIGH.
- Arduino UNO: `SDA = A4`, `SCL = A5`.
- ESP32 DevKit comum: `SDA = GPIO21`, `SCL = GPIO22`.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `i2cAddress` | number | 118 | 118 | 119 |  | sim |
| `temperatureOffsetC` | number | 0 | -20 | 20 | `°C` | sim |
| `pressureOffsetHpa` | number | 0 | -100 | 100 | `hPa` | sim |
| `oversampling` | string | `x1` |  |  |  | não na primeira entrega |

Variantes sugeridas:

- `I2C 0x76`: `i2cAddress = 118`.
- `I2C 0x77`: `i2cAddress = 119`.

Notas:

- JSON usa número decimal para endereço: `118` equivale a `0x76`; `119` equivale a `0x77`.
- Offsets permitem simular calibração sem alterar o ambiente global.
- Oversampling pode existir no manifest, mas não precisa afetar a primeira simulação.

#### Modelo Elétrico

Obrigatório.

Modelo inicial:

- `electricalModel.type`: `sensor-module`.
- `electricalModel.logicVoltage`: `3.3`.
- `electricalModel.toleratesFiveVoltPower`: depende do módulo; default conservador deve ser `false` se não houver level shifter.
- `electricalModel.bus`: `i2c`.
- `electricalModel.inputCurrentAmps`: valor aproximado baixo, por exemplo `0.001`.

Falhas que devem gerar problema:

- Sensor sem VCC ou sem GND.
- VCC acima do recomendado quando o módulo não tolera 5V.
- SDA/SCL não conectados ao mesmo microcontrolador.
- SDA/SCL invertidos.
- Endereço I2C duplicado no mesmo barramento.
- Firmware tentando acessar endereço diferente do manifest.

#### Comportamento Simulado

O BMP280 deve ler um canal ambiental climático.

- Entrada ambiental: `climate`.
- Fonte ambiental esperada: `environment.climate`.
- Se `climate.temperatureC = 25`, `readTemperature()` retorna `25 + temperatureOffsetC`.
- Se `climate.pressureHpa = 1013.25`, `readPressure()` retorna `101325 Pa` quando a API espera pascal, ou `1013.25 hPa` quando a API simulada expõe hPa.
- O visual do sensor deve indicar temperatura e pressão atuais.
- Alterar o ambiente climático não deve reiniciar a simulação nem resetar o tempo virtual.

Comportamento esperado:

| ambiente | leitura de temperatura | leitura de pressão |
| --- | --- | --- |
| 20 °C / 1013.25 hPa | próximo de `20.0` | próximo de `101325 Pa` |
| 35 °C / 1000 hPa | próximo de `35.0` | próximo de `100000 Pa` |
| -5 °C / 850 hPa | próximo de `-5.0` | próximo de `85000 Pa` |

Importante:

- O runtime deve modelar dispositivos I2C por endereço, não chamadas hardcoded para BMP280 no exemplo.
- O sensor pode oferecer uma API de biblioteca simulada para simplificar o firmware, mas essa API deve internamente usar o dispositivo I2C ou um registro de sensor genérico.
- Regras do BMP280 devem ficar no behavior do componente.

#### Firmware/WASM

APIs necessárias para o caminho realista:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `Wire.begin()` | sim | sim | inicializa barramento I2C |
| `Wire.beginTransmission(address)` | sim | sim | seleciona dispositivo |
| `Wire.write(value)` | sim | sim | escreve registrador/comando |
| `Wire.endTransmission()` | sim | sim | finaliza escrita |
| `Wire.requestFrom(address, count)` | sim | sim | solicita bytes |
| `Wire.read()` | sim | sim | lê bytes |
| `Serial.begin(baud)` | sim | sim | exemplo imprime leituras |
| `Serial.print/println` | sim | sim | exemplo imprime temperatura/pressão |
| `delay(ms)` | sim | sim | exemplo roda em loop |

API de biblioteca simulada aceitável para primeira entrega, se I2C bruto ainda for grande demais:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `BMP280.begin(address)` | sim | sim | valida presença/endereço |
| `BMP280.readTemperature()` | sim | sim | retorna `float` em °C |
| `BMP280.readPressure()` | sim | sim | retorna `float` em Pa |

Decisão recomendada:

- Implementar `Wire` mínimo e uma classe shim compatível com exemplo simples, como `Adafruit_BMP280 bmp;`.
- Se a classe de biblioteca for simulada, documentar claramente que não é a biblioteca real completa.
- Não criar fallback IR; tudo deve compilar pelo caminho WASM.

Constantes esperadas:

- `A4`/`A5` para Arduino UNO devem compilar se o exemplo usar `Wire` implicitamente.
- Endereços `0x76` e `0x77` devem compilar normalmente como literais C++.

Se `Wire` ainda não existir no caminho WASM, esta entrega deve implementar o subset mínimo antes de considerar o BMP280 pronto.

#### UI e Inspector

- Grupo no catálogo: `Sensors`.
- Subgrupo: `Environment` ou `Pressure`.
- Ícone/classe visual: `bmp280-icon`, `bmp280-sensor`.
- Tamanho padrão: aproximadamente `170x118`.
- Propriedades editáveis no board: endereço I2C `0x76/0x77`.
- Propriedades editáveis no inspector: `i2cAddress`, `temperatureOffsetC`, `pressureOffsetHpa`.
- Leituras/sinais exibidos no inspector: temperatura, pressão, endereço I2C, barramento conectado, alimentação OK/ausente.
- Estados visuais: temperatura/pressão atuais e status I2C conectado/desconectado.

#### Exemplos Obrigatórios

##### `examples/bmp280-weather-i2c/project.json`

- Nome: `BMP280 Weather I2C`.
- Componentes usados: Arduino UNO ou ESP32 DevKit, BMP280 e Climate Environment.
- Conexões elétricas para Arduino UNO:
  - VCC do BMP280 em `3V3`.
  - GND do BMP280 em GND.
  - SDA do BMP280 em `A4`.
  - SCL do BMP280 em `A5`.
- Conexões elétricas para ESP32, se o exemplo usar ESP32:
  - VCC em `3V3`.
  - GND em GND.
  - SDA em `IO21`.
  - SCL em `IO22`.
- Conexões ambientais:
  - Climate Environment standalone alimenta o canal ambiental `climate`.
- Código `main.ino`:
  - Inicializa Serial.
  - Inicializa `Wire`.
  - Inicializa BMP280 no endereço `0x76`.
  - Imprime temperatura em °C.
  - Imprime pressão em hPa ou Pa com unidade clara.
- O que deve aparecer no Serial: histórico append-only com temperatura e pressão atualizadas conforme o ambiente.
- O que deve mudar visualmente no board: BMP280 mostra temperatura/pressão atuais.
- Problemas esperados: endereço I2C errado ou SDA/SCL ausentes devem gerar warning.

Código de referência com API simulada mínima:

```cpp
#include <Wire.h>

BMP280 bmp;

void setup()
{
    Serial.begin(115200);
    Wire.begin();

    if (!bmp.begin(0x76)) {
        Serial.println("BMP280 not found");
        return;
    }

    Serial.println("BMP280 ready");
}

void loop()
{
    Serial.print("Temperature C: ");
    Serial.println(bmp.readTemperature());

    Serial.print("Pressure hPa: ");
    Serial.println(bmp.readPressure() / 100.0);

    delay(1000);
}
```

Código de referência com I2C bruto, opcional para etapa mais avançada:

```cpp
#include <Wire.h>

const int BMP280_ADDRESS = 0x76;

void setup()
{
    Serial.begin(115200);
    Wire.begin();
    Serial.println("BMP280 raw I2C ready");
}

void loop()
{
    Wire.beginTransmission(BMP280_ADDRESS);
    Wire.write(0xF7);
    Wire.endTransmission();
    Wire.requestFrom(BMP280_ADDRESS, 6);

    while (Wire.available() > 0) {
        Serial.println(Wire.read());
    }

    delay(1000);
}
```

#### Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo I2C contém microcontrolador, BMP280 e Climate Environment.
- [ ] Firmware do exemplo compila pelo caminho WASM.
- [ ] Shim WASM suporta `#include <Wire.h>`.
- [ ] Shim/runtime WASM suporta subset mínimo de `Wire`.
- [ ] Runtime registra dispositivo I2C no endereço do manifest.
- [ ] Runtime retorna temperatura e pressão a partir do ambiente climático.
- [ ] Alterar temperatura/pressão no input ambiental não reinicia o tempo virtual.
- [ ] Inspector mostra temperatura, pressão, endereço e status I2C.
- [ ] Serial mostra valores atualizados conforme o ambiente.

#### Critérios de Aceite

- [ ] BMP280 aparece em `Sensors/Environment` ou `Sensors/Pressure`.
- [ ] Climate Environment aparece em `Inputs/Weather`.
- [ ] Ambos podem ser adicionados ao board.
- [ ] Terminais VCC/GND/SDA/SCL conectam corretamente.
- [ ] Ambiente climático pode ser editado pela UI sem reiniciar a simulação.
- [ ] Exemplo I2C carrega pelo modal `Exemplos`.
- [ ] Firmware do exemplo compila em WASM.
- [ ] `bmp.readTemperature()` reflete `temperatureC`.
- [ ] `bmp.readPressure()` reflete `pressureHpa`.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Biblioteca Adafruit BMP280 completa.
- Compensação real por coeficientes de calibração internos.
- Altitude real com fórmula barométrica precisa.
- Umidade, porque BMP280 não mede umidade.
- SPI completo na primeira entrega.
- Ruído, drift e oversampling real.

### Climate Environment

#### Identidade

- `identity.id`: `environment.climate`.
- `identity.name`: `Clima`.
- `identity.category`: `environment`.
- `identity.subCategory`: `weather`.
- Caminho esperado: `components/official/climate/component.json`.

#### Papel na Simulação

- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`.
- `simulation.implemented`: `true`.
- Observações: componente standalone, igual ao padrão de Wi-Fi Signal, Rain Environment e Light Environment; não precisa de fio elétrico.

#### Terminais

Opção recomendada: sem terminais.

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |

Alternativa futura se for necessário desenhar vínculo ambiental:

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `climate` | CLIMATE | `environment-output` | left | 0 | 58 | environment |

Decisão inicial: usar standalone sem terminais, porque temperatura e pressão são condições ambientais do cenário.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `temperatureC` | number | 25 | -40 | 85 | `°C` | sim |
| `pressureHpa` | number | 1013.25 | 300 | 1100 | `hPa` | sim |
| `enabled` | boolean | true |  |  |  | sim |

Variantes sugeridas:

- `Sea level`: `temperatureC = 25`, `pressureHpa = 1013.25`.
- `Cold high altitude`: `temperatureC = -5`, `pressureHpa = 850`.
- `Hot low pressure`: `temperatureC = 35`, `pressureHpa = 1000`.

#### Modelo Elétrico

Não possui `electricalModel`. É uma fonte ambiental.

#### Comportamento Simulado

- Publica canal ambiental `climate`.
- `enabled = false`: sensor deve reportar última leitura válida ou ambiente indisponível, conforme decisão do runtime.
- `enabled = true`: usa `temperatureC` e `pressureHpa`.
- Alterações devem atualizar a simulação em tempo real sem resetar o firmware.

#### Firmware/WASM

Não expõe APIs diretamente. O firmware acessa o efeito do clima por sensores como BMP280 via I2C/API simulada.

#### UI e Inspector

- Grupo no catálogo: `Inputs`.
- Subgrupo: `Weather`.
- Ícone/classe visual: `climate-icon`, `climate-environment`.
- Tamanho padrão: aproximadamente `210x124`.
- Propriedades editáveis no board: sliders/campos de temperatura e pressão, toggle `enabled`.
- Propriedades editáveis no inspector: `enabled`, `temperatureC`, `pressureHpa`.
- Leituras/sinais exibidos no inspector: temperatura, pressão e status.
- Estados visuais: clima ativo/inativo, pressão baixa/normal/alta.

#### Exemplos Obrigatórios

Usado pelo exemplo `examples/bmp280-weather-i2c/project.json`.

#### Testes Obrigatórios

- [ ] JSON válido.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Aparece em `Inputs/Weather`.
- [ ] UI permite alterar `temperatureC` e `pressureHpa`.
- [ ] Alteração do clima atualiza sensores dependentes sem resetar tempo virtual.

#### Critérios de Aceite

- [ ] Climate Environment aparece no catálogo.
- [ ] Pode ser adicionado ao board.
- [ ] Controles de temperatura e pressão funcionam no board e no inspector.
- [ ] BMP280 responde ao ambiente climático.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Modelo climático espacial.
- Previsão do tempo.
- Variação automática por tempo.
- Umidade relativa.
- Conversão precisa de altitude.

# Add Components: ADS1015 ADC

## Objetivo

Adicionar suporte ao ADS1015, um ADC externo de 12 bits por I2C. O ADS1015 é muito parecido com o ADS1115, mas tem resolução menor e taxa de amostragem maior. O projeto deve modelar essa diferença em vez de tratar ambos como o mesmo componente visual.

- Componentes a adicionar: ADS1015 ADC.
- Cenário principal de uso: microcontrolador lê canal A0 do ADS1015 por I2C e imprime valor bruto/tensão no Serial.
- Exemplo final esperado: board com microcontrolador, ADS1015, Analog Voltage Source e `main.ino` imprimindo leitura de 12 bits.
- O componente deve afetar a simulação: sim, por firmware, barramento I2C, leitura analógica externa e estado visual.

## Componentes

### ADS1015 ADC

#### Identidade

- `identity.id`: `converter.adc.ads1015`.
- `identity.name`: `ADS1015 ADC`.
- `identity.category`: `converter`.
- `identity.subCategory`: `adc`.
- Caminho esperado: `components/official/ads1015/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `electrical`, `environment`, `visual-state`.
- `simulation.implemented`: `true` se I2C/WASM e leitura de canais forem implementados nesta entrega.
- Observações: deve compartilhar infraestrutura de I2C/ADC com ADS1115, mas preservar resolução e sample rate próprios.

Regras:

- Deve declarar `behavior`.
- Deve declarar `electricalModel`.
- Deve aparecer em `Electronic/ADCs` ou `Converters/ADC`.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vdd` | VDD | `power-input` | left | 0 | 24 | power |
| `gnd` | GND | `ground` | bottom | 92 | 132 | ground |
| `scl` | SCL | `i2c-scl` | right | 184 | 34 | signal |
| `sda` | SDA | `i2c-sda` | right | 184 | 62 | signal |
| `addr` | ADDR | `digital-input` | top | 92 | 0 | signal |
| `alrt` | ALRT | `digital-output` | top | 132 | 0 | signal |
| `a0` | A0 | `analog-input` | left | 0 | 56 | signal |
| `a1` | A1 | `analog-input` | left | 0 | 78 | signal |
| `a2` | A2 | `analog-input` | left | 0 | 100 | signal |
| `a3` | A3 | `analog-input` | left | 0 | 122 | signal |

Notas:

- Mesma pinagem lógica do ADS1115.
- Endereços I2C: `0x48..0x4B`.
- `ALRT` pode ficar fora da primeira entrega.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `i2cAddress` | number | 72 | 72 | 75 |  | sim |
| `gain` | string | `2.048V` |  |  |  | sim |
| `sampleRateSps` | number | 1600 | 128 | 3300 | `SPS` | sim |
| `mode` | string | `single-shot` |  |  |  | não na primeira entrega |

Variantes sugeridas:

- `ADDR GND / 0x48`: `i2cAddress = 72`.
- `ADDR VDD / 0x49`: `i2cAddress = 73`.
- `ADDR SDA / 0x4A`: `i2cAddress = 74`.
- `ADDR SCL / 0x4B`: `i2cAddress = 75`.

Notas:

- ADS1015 é 12-bit com sinal; leitura single-ended costuma mapear `0..FSR` para `0..2047`.
- A diferença principal para ADS1115 deve aparecer em `resolutionBits`, range bruto e taxas de amostragem.

#### Modelo Elétrico

Obrigatório.

Modelo inicial:

- `electricalModel.type`: `adc`.
- `electricalModel.resolutionBits`: `12`.
- `electricalModel.bus`: `i2c`.
- `electricalModel.inputChannels`: `4`.
- `electricalModel.differential`: `true`.
- `electricalModel.logicVoltage`: derivado de `VDD`.

Falhas que devem gerar problema:

- ADS1015 sem VDD ou GND.
- SDA/SCL ausentes ou invertidos.
- Endereço I2C duplicado.
- Entrada acima do range configurado.
- Firmware acessando endereço errado.

#### Comportamento Simulado

O ADS1015 deve ler tensões externas conectadas aos canais `A0..A3`.

- Entrada analógica principal para primeira entrega: `a0`.
- Fonte sugerida: `environment.analog-voltage-source`.
- Para `gain = 2.048V`, `1.024V` deve produzir leitura próxima de metade da escala de 12 bits.
- O visual deve indicar canal ativo, tensão e valor bruto.
- Alterar tensão da fonte analógica não deve reiniciar a simulação.

Comportamento esperado para `gain = 2.048V`:

| tensão A0 | leitura bruta aproximada |
| --- | --- |
| `0V` | `0` |
| `1.024V` | `1024` |
| `2.048V` | `2047` |
| `3.3V` | saturado em `2047` |

#### Firmware/WASM

APIs necessárias:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `Wire.begin()` | sim | sim | inicializa I2C |
| `Wire.beginTransmission(address)` | sim | sim | seleciona ADS1015 |
| `Wire.write(value)` | sim | sim | registradores/configuração |
| `Wire.endTransmission()` | sim | sim | finaliza escrita |
| `Wire.requestFrom(address, count)` | sim | sim | solicita bytes |
| `Wire.read()` | sim | sim | lê bytes |
| `Serial.begin/print/println` | sim | sim | exemplo imprime leituras |
| `delay(ms)` | sim | sim | exemplo roda em loop |

API simulada aceitável para primeira entrega:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `ADS1015.begin(address)` | sim | sim | valida presença/endereço |
| `ADS1015.readADC_SingleEnded(channel)` | sim | sim | retorna leitura bruta 12-bit |
| `ADS1015.computeVolts(raw)` | sim | sim | converte para volts pelo gain |

#### UI e Inspector

- Grupo no catálogo: `Electronic`.
- Subgrupo: `ADCs`.
- Ícone/classe visual: `ads1015-icon`, `ads1015-adc`.
- Tamanho padrão: aproximadamente `184x132`.
- Propriedades editáveis no board: endereço I2C e gain.
- Propriedades editáveis no inspector: `i2cAddress`, `gain`, `sampleRateSps`.
- Leituras/sinais exibidos no inspector: tensão por canal, leitura bruta 12-bit, endereço I2C e status.
- Estados visuais: conectado/desconectado, canal ativo, saturação.

#### Exemplos Obrigatórios

##### `examples/ads1015-single-ended/project.json`

- Nome: `ADS1015 Single Ended`.
- Componentes usados: Arduino UNO ou ESP32 DevKit, ADS1015 e Analog Voltage Source.
- Conexões elétricas para Arduino UNO:
  - VDD em `3V3` ou `5V`, conforme `electricalModel`.
  - GND em GND.
  - SDA em `A4`.
  - SCL em `A5`.
  - Analog Voltage Source em `A0` do ADS1015.
- Código `main.ino`:
  - Inicializa Serial.
  - Inicializa `Wire`.
  - Inicializa ADS1015 no endereço `0x48`.
  - Lê canal `0`.
  - Imprime leitura bruta e tensão.

Código de referência com API simulada mínima:

```cpp
#include <Wire.h>

ADS1015 ads;

void setup()
{
    Serial.begin(115200);
    Wire.begin();

    if (!ads.begin(0x48)) {
        Serial.println("ADS1015 not found");
        return;
    }

    Serial.println("ADS1015 ready");
}

void loop()
{
    const int raw = ads.readADC_SingleEnded(0);

    Serial.print("ADS1015 A0 raw: ");
    Serial.println(raw);
    Serial.print("ADS1015 A0 volts: ");
    Serial.println(ads.computeVolts(raw));

    delay(1000);
}
```

#### Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo contém microcontrolador, ADS1015 e Analog Voltage Source.
- [ ] Firmware do exemplo compila pelo caminho WASM.
- [ ] Runtime registra dispositivo I2C no endereço do manifest.
- [ ] Runtime converte tensão de A0 em leitura 12-bit.
- [ ] Alterar tensão da fonte analógica não reinicia o tempo virtual.

#### Critérios de Aceite

- [ ] ADS1015 aparece em `Electronic/ADCs`.
- [ ] Pode ser adicionado ao board.
- [ ] Exemplo carrega pelo modal `Exemplos`.
- [ ] Firmware compila em WASM.
- [ ] `readADC_SingleEnded(0)` reflete a fonte analógica com escala 12-bit.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Comparador `ALRT`.
- Modo contínuo real.
- Todas as taxas de amostragem com temporização precisa.
- Leitura diferencial completa na primeira entrega.
- Ruído e erro real de quantização.

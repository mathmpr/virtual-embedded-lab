# Add Components: ADS1115 ADC

## Objetivo

Adicionar suporte ao conversor analógico-digital ADS1115, um ADC externo de 16 bits por I2C. O componente deve permitir que projetos com Arduino/ESP32 leiam sinais analógicos externos com maior resolução que o ADC interno.

- Componentes a adicionar: ADS1115 ADC e Analog Voltage Source.
- Cenário principal de uso: microcontrolador lê canal A0 do ADS1115 por I2C e imprime o valor no Serial.
- Exemplo final esperado: board com microcontrolador, ADS1115, fonte analógica standalone e `main.ino` imprimindo leitura bruta e tensão.
- O componente deve afetar a simulação: sim, por firmware, barramento I2C, leitura analógica externa e estado visual.

## Componentes

### ADS1115 ADC

#### Identidade

- `identity.id`: `converter.adc.ads1115`.
- `identity.name`: `ADS1115 ADC`.
- `identity.category`: `converter`.
- `identity.subCategory`: `adc`.
- Caminho esperado: `components/official/ads1115/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `electrical`, `environment`, `visual-state`.
- `simulation.implemented`: `true` se I2C/WASM e leitura de canais forem implementados nesta entrega.
- Observações: o ADS1115 deve validar o modelo de periféricos I2C genéricos, não uma leitura hardcoded por exemplo.

Regras:

- Deve declarar `behavior`, porque converte sinais analógicos externos em leituras de firmware.
- Deve declarar `electricalModel`, porque depende de alimentação, GND, I2C e limites de tensão de entrada.
- Deve aparecer em `Electronic/ADC` ou `Converters/ADC`.
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

- Primeira entrega deve usar I2C por `VDD`, `GND`, `SCL` e `SDA`.
- `ALRT` pode aparecer no manifest, mas comparador/alerta fica fora da primeira entrega.
- `ADDR` define endereço I2C; a primeira entrega pode usar propriedade `i2cAddress` em vez de simular fisicamente o terminal.
- Arduino UNO: `SDA = A4`, `SCL = A5`.
- ESP32 DevKit comum: `SDA = GPIO21`, `SCL = GPIO22`.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `i2cAddress` | number | 72 | 72 | 75 |  | sim |
| `gain` | string | `2.048V` |  |  |  | sim |
| `sampleRateSps` | number | 128 | 8 | 860 | `SPS` | sim |
| `mode` | string | `single-shot` |  |  |  | não na primeira entrega |

Variantes sugeridas:

- `ADDR GND / 0x48`: `i2cAddress = 72`.
- `ADDR VDD / 0x49`: `i2cAddress = 73`.
- `ADDR SDA / 0x4A`: `i2cAddress = 74`.
- `ADDR SCL / 0x4B`: `i2cAddress = 75`.

Notas:

- JSON usa decimal para endereço: `72` equivale a `0x48`.
- `gain` define full-scale range. Para primeira entrega, `2.048V` é suficiente.
- ADS1115 é 16-bit com sinal; leitura single-ended costuma mapear `0..FSR` para `0..32767`.

#### Modelo Elétrico

Obrigatório.

Modelo inicial:

- `electricalModel.type`: `adc`.
- `electricalModel.resolutionBits`: `16`.
- `electricalModel.bus`: `i2c`.
- `electricalModel.inputChannels`: `4`.
- `electricalModel.differential`: `true`.
- `electricalModel.logicVoltage`: derivado de `VDD`.

Falhas que devem gerar problema:

- ADS1115 sem VDD ou sem GND.
- SDA/SCL ausentes ou invertidos.
- Endereço I2C duplicado no mesmo barramento.
- Entrada analógica acima do range configurado.
- Entrada analógica abaixo de GND ou acima de VDD.
- Firmware acessando endereço diferente do manifest.

#### Comportamento Simulado

O ADS1115 deve ler tensões externas conectadas aos canais `A0..A3`.

- Entrada analógica principal para primeira entrega: `a0`.
- Fonte sugerida: `environment.analog-voltage-source`.
- Se `a0 = 1.024V` e `gain = 2.048V`, leitura single-ended esperada fica próxima de metade da escala.
- Leitura deve respeitar saturação no range configurado.
- O visual deve indicar canal ativo, tensão e valor bruto.
- Alterar a tensão da fonte analógica não deve reiniciar a simulação nem resetar o tempo virtual.

Comportamento esperado para `gain = 2.048V`:

| tensão A0 | leitura bruta aproximada |
| --- | --- |
| `0V` | `0` |
| `1.024V` | `16384` |
| `2.048V` | `32767` |
| `3.3V` | saturado em `32767` |

Importante:

- O runtime deve modelar dispositivos I2C por endereço.
- O ADC deve obter tensão a partir do grafo/fonte analógica, não de uma constante no firmware.
- O ADS1115 pode oferecer uma API de biblioteca simulada, mas ela deve usar o dispositivo I2C registrado.

#### Firmware/WASM

APIs necessárias para caminho realista:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `Wire.begin()` | sim | sim | inicializa I2C |
| `Wire.beginTransmission(address)` | sim | sim | seleciona ADS1115 |
| `Wire.write(value)` | sim | sim | registradores/configuração |
| `Wire.endTransmission()` | sim | sim | finaliza escrita |
| `Wire.requestFrom(address, count)` | sim | sim | solicita bytes |
| `Wire.read()` | sim | sim | lê bytes |
| `Serial.begin/print/println` | sim | sim | exemplo imprime leituras |
| `delay(ms)` | sim | sim | exemplo roda em loop |

API simulada aceitável para primeira entrega:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `ADS1115.begin(address)` | sim | sim | valida presença/endereço |
| `ADS1115.readADC_SingleEnded(channel)` | sim | sim | retorna leitura bruta |
| `ADS1115.computeVolts(raw)` | sim | sim | converte para volts pelo gain |

Se `Wire` ainda não existir no caminho WASM, esta entrega deve implementar o subset mínimo antes de considerar ADS1115 pronto.

#### UI e Inspector

- Grupo no catálogo: `Electronic`.
- Subgrupo: `ADCs`.
- Ícone/classe visual: `ads1115-icon`, `ads1115-adc`.
- Tamanho padrão: aproximadamente `184x132`.
- Propriedades editáveis no board: endereço I2C e gain.
- Propriedades editáveis no inspector: `i2cAddress`, `gain`, `sampleRateSps`.
- Leituras/sinais exibidos no inspector: tensão por canal, leitura bruta, endereço I2C e status do barramento.
- Estados visuais: conectado/desconectado, canal ativo, saturação.

#### Exemplos Obrigatórios

##### `examples/ads1115-single-ended/project.json`

- Nome: `ADS1115 Single Ended`.
- Componentes usados: Arduino UNO ou ESP32 DevKit, ADS1115 e Analog Voltage Source.
- Conexões elétricas para Arduino UNO:
  - VDD em `3V3` ou `5V`, conforme `electricalModel`.
  - GND em GND.
  - SDA em `A4`.
  - SCL em `A5`.
  - Analog Voltage Source em `A0` do ADS1115.
- Código `main.ino`:
  - Inicializa Serial.
  - Inicializa `Wire`.
  - Inicializa ADS1115 no endereço `0x48`.
  - Lê canal `0`.
  - Imprime leitura bruta e tensão.

Código de referência com API simulada mínima:

```cpp
#include <Wire.h>

ADS1115 ads;

void setup()
{
    Serial.begin(115200);
    Wire.begin();

    if (!ads.begin(0x48)) {
        Serial.println("ADS1115 not found");
        return;
    }

    Serial.println("ADS1115 ready");
}

void loop()
{
    const int raw = ads.readADC_SingleEnded(0);

    Serial.print("ADS1115 A0 raw: ");
    Serial.println(raw);
    Serial.print("ADS1115 A0 volts: ");
    Serial.println(ads.computeVolts(raw));

    delay(1000);
}
```

#### Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo contém microcontrolador, ADS1115 e Analog Voltage Source.
- [ ] Firmware do exemplo compila pelo caminho WASM.
- [ ] Shim/runtime WASM suporta subset mínimo de `Wire`.
- [ ] Runtime registra dispositivo I2C no endereço do manifest.
- [ ] Runtime converte tensão de A0 em leitura 16-bit.
- [ ] Alterar tensão da fonte analógica não reinicia o tempo virtual.
- [ ] Inspector mostra valor bruto, tensão e saturação.

#### Critérios de Aceite

- [ ] ADS1115 aparece em `Electronic/ADCs`.
- [ ] Pode ser adicionado ao board.
- [ ] Terminais VDD/GND/SDA/SCL/A0 conectam corretamente.
- [ ] Exemplo carrega pelo modal `Exemplos`.
- [ ] Firmware compila em WASM.
- [ ] `readADC_SingleEnded(0)` reflete a fonte analógica.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Comparador `ALRT`.
- Modo contínuo real.
- Todas as taxas de amostragem com temporização precisa.
- Leitura diferencial completa na primeira entrega.
- Ruído e erro real de quantização.

### Analog Voltage Source

#### Identidade

- `identity.id`: `environment.analog-voltage-source`.
- `identity.name`: `Fonte analógica`.
- `identity.category`: `environment`.
- `identity.subCategory`: `analog`.
- Caminho esperado: `components/official/analog-voltage-source/component.json`.

#### Papel na Simulação

- `simulation.kind`: `environment-source`.
- `simulation.effects`: `environment`, `electrical`.
- `simulation.implemented`: `true`.
- Observações: pode ser compartilhada com ADS1015, MCP3008 e outros ADCs.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `out` | OUT | `analog-output` | right | 180 | 58 | signal |
| `gnd` | GND | `ground` | bottom | 90 | 104 | ground |

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `voltageVolts` | number | 1.024 | 0 | 5 | `V` | sim |
| `enabled` | boolean | true |  |  |  | sim |

#### Critérios de Aceite

- [ ] Fonte aparece em `Inputs/Analog`.
- [ ] Slider/campo de tensão atualiza ADCs sem resetar a simulação.
- [ ] Pode ser reutilizada por ADS1115, ADS1015 e MCP3008.

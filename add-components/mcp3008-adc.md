# Add Components: MCP3008 ADC

Antes de usar este documento, leia `docs/official-component-guidelines.md` e `docs/component-contract.md`. A implementação deve seguir manifests, resolvers e adapters, não lógica específica no editor/runtime central.

## Objetivo

Adicionar suporte ao MCP3008, um ADC externo de 10 bits por SPI com 8 canais. O componente deve permitir leitura analógica por firmware usando barramento SPI, validando o caminho de periféricos SPI reais no projeto.

- Componentes a adicionar: MCP3008 ADC.
- Cenário principal de uso: microcontrolador lê canal CH0 do MCP3008 por SPI e imprime o valor no Serial.
- Exemplo final esperado: board com microcontrolador, MCP3008, Analog Voltage Source e `main.ino` imprimindo leitura de 10 bits.
- O componente deve afetar a simulação: sim, por firmware, barramento SPI, leitura analógica externa e estado visual.

## Componentes

### MCP3008 ADC

#### Identidade

- `identity.id`: `converter.adc.mcp3008`.
- `identity.name`: `MCP3008 ADC`.
- `identity.category`: `converter`.
- `identity.subCategory`: `adc`.
- Caminho esperado: `components/official/mcp3008/component.json`.

#### Papel na Simulação

- `simulation.kind`: `behavioral-sensor`.
- `simulation.effects`: `firmware`, `electrical`, `environment`, `visual-state`.
- `simulation.implemented`: `true` se SPI/WASM e leitura de canais forem implementados nesta entrega.
- Observações: deve validar SPI, chip select e comandos de transferência, não apenas uma API fake isolada.

Regras:

- Deve declarar `behavior`.
- Deve declarar `electricalModel`.
- Deve aparecer em `Electronic/ADCs` ou `Converters/ADC`.
- `visual.terminals` deve ter os mesmos IDs de `terminals`.

#### Terminais

| id | label | type | visual side | x | y | kind |
| --- | --- | --- | --- | --- | --- | --- |
| `vdd` | VDD | `power-input` | left | 0 | 24 | power |
| `vref` | VREF | `power-input` | left | 0 | 48 | power |
| `agnd` | AGND | `ground` | bottom | 70 | 156 | ground |
| `dgnd` | DGND | `ground` | bottom | 118 | 156 | ground |
| `clk` | CLK | `spi-sck` | right | 220 | 36 | signal |
| `dout` | DOUT | `spi-miso` | right | 220 | 64 | signal |
| `din` | DIN | `spi-mosi` | right | 220 | 92 | signal |
| `cs` | CS/SHDN | `spi-cs` | right | 220 | 120 | signal |
| `ch0` | CH0 | `analog-input` | left | 0 | 78 | signal |
| `ch1` | CH1 | `analog-input` | left | 0 | 96 | signal |
| `ch2` | CH2 | `analog-input` | left | 0 | 114 | signal |
| `ch3` | CH3 | `analog-input` | left | 0 | 132 | signal |
| `ch4` | CH4 | `analog-input` | top | 36 | 0 | signal |
| `ch5` | CH5 | `analog-input` | top | 72 | 0 | signal |
| `ch6` | CH6 | `analog-input` | top | 108 | 0 | signal |
| `ch7` | CH7 | `analog-input` | top | 144 | 0 | signal |

Notas:

- Arduino UNO SPI padrão: `D13 = SCK`, `D12 = MISO`, `D11 = MOSI`, CS pode ser `D10`.
- ESP32 DevKit comum pode usar VSPI: `SCK = GPIO18`, `MISO = GPIO19`, `MOSI = GPIO23`, CS configurável.
- `VREF` define escala de conversão.
- `AGND` e `DGND` devem estar em GND para leitura válida.

#### Propriedades e Variantes

| property | type | default | min | max | unit | editável na UI? |
| --- | --- | --- | --- | --- | --- | --- |
| `resolutionBits` | number | 10 | 10 | 10 |  | não |
| `referenceVoltageVolts` | number | 5 | 1 | 5.5 | `V` | sim |
| `spiMode` | number | 0 | 0 | 3 |  | não na primeira entrega |
| `maxClockHz` | number | 1350000 | 100000 | 3600000 | `Hz` | não na primeira entrega |

Sem variantes iniciais.

Notas:

- Leitura single-ended usa escala `0..1023`.
- `referenceVoltageVolts` deve vir de VREF quando o solver de tensão estiver disponível; propriedade manual é aceitável na primeira entrega.

#### Modelo Elétrico

Obrigatório.

Modelo inicial:

- `electricalModel.type`: `adc`.
- `electricalModel.resolutionBits`: `10`.
- `electricalModel.bus`: `spi`.
- `electricalModel.inputChannels`: `8`.
- `electricalModel.differential`: `true`.
- `electricalModel.referenceVoltageProperty`: `referenceVoltageVolts`.

Falhas que devem gerar problema:

- MCP3008 sem VDD, VREF, AGND ou DGND.
- CLK/MISO/MOSI/CS ausentes ou invertidos.
- Entrada analógica acima de VREF.
- Entrada analógica abaixo de GND.
- CS compartilhado incorretamente no mesmo barramento.
- Firmware usando canal fora de `0..7`.

#### Comportamento Simulado

O MCP3008 deve ler tensões externas conectadas aos canais `CH0..CH7`.

- Entrada analógica principal para primeira entrega: `ch0`.
- Fonte sugerida: `environment.analog-voltage-source`.
- Se `CH0 = 2.5V` e `VREF = 5V`, leitura esperada próxima de `512`.
- O visual deve indicar canal ativo, tensão e valor bruto.
- Alterar a tensão da fonte analógica não deve reiniciar a simulação.

Comportamento esperado para `VREF = 5V`:

| tensão CH0 | leitura bruta aproximada |
| --- | --- |
| `0V` | `0` |
| `2.5V` | `512` |
| `5V` | `1023` |
| `6V` | saturado em `1023` |

Importante:

- O runtime deve modelar dispositivos SPI por CS.
- `SPI.transfer` deve ser suficiente para simular comando MCP3008 básico.
- Uma API simulada `MCP3008.read(channel)` é aceitável para primeira entrega, mas deve ficar claramente documentada como shim simplificado.

#### Firmware/WASM

APIs necessárias para caminho realista:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `SPI.begin()` | sim | sim | inicializa SPI |
| `SPI.transfer(value)` | sim | sim | troca bytes com o ADC |
| `pinMode(cs, OUTPUT)` | sim | sim | configura CS |
| `digitalWrite(cs, LOW/HIGH)` | sim | sim | seleciona/desseleciona MCP3008 |
| `Serial.begin/print/println` | sim | sim | exemplo imprime leituras |
| `delay(ms)` | sim | sim | exemplo roda em loop |

API simulada aceitável para primeira entrega:

| API | precisa compilar? | precisa simular comportamento? | observação |
| --- | --- | --- | --- |
| `MCP3008.begin(csPin)` | sim | sim | registra CS |
| `MCP3008.read(channel)` | sim | sim | retorna leitura bruta 10-bit |

Se `SPI` ainda não existir no caminho WASM, esta entrega deve implementar o subset mínimo antes de considerar MCP3008 pronto.

#### UI e Inspector

- Grupo no catálogo: `Electronic`.
- Subgrupo: `ADCs`.
- Ícone/classe visual: `mcp3008-icon`, `mcp3008-adc`.
- Tamanho padrão: aproximadamente `220x156`.
- Propriedades editáveis no board: `referenceVoltageVolts`.
- Propriedades editáveis no inspector: `referenceVoltageVolts`, `spiMode`, `maxClockHz`.
- Leituras/sinais exibidos no inspector: tensão por canal, leitura bruta 10-bit, CS, status SPI e saturação.
- Estados visuais: conectado/desconectado, canal ativo, saturação.

#### Exemplos Obrigatórios

##### `examples/mcp3008-single-ended/project.json`

- Nome: `MCP3008 Single Ended`.
- Componentes usados: Arduino UNO ou ESP32 DevKit, MCP3008 e Analog Voltage Source.
- Conexões elétricas para Arduino UNO:
  - VDD em `5V`.
  - VREF em `5V`.
  - AGND e DGND em GND.
  - CLK em `D13`.
  - DOUT em `D12`.
  - DIN em `D11`.
  - CS em `D10`.
  - Analog Voltage Source em `CH0`.
- Código `main.ino`:
  - Inicializa Serial.
  - Inicializa `SPI`.
  - Lê canal `0`.
  - Imprime leitura bruta.

Código de referência com API simulada mínima:

```cpp
#include <SPI.h>

MCP3008 adc;

void setup()
{
    Serial.begin(115200);
    SPI.begin();

    if (!adc.begin(10)) {
        Serial.println("MCP3008 not found");
        return;
    }

    Serial.println("MCP3008 ready");
}

void loop()
{
    const int raw = adc.read(0);

    Serial.print("MCP3008 CH0 raw: ");
    Serial.println(raw);

    delay(1000);
}
```

Código de referência com SPI bruto, opcional:

```cpp
#include <SPI.h>

const int CS_PIN = 10;

int readMcp3008(int channel)
{
    digitalWrite(CS_PIN, LOW);
    SPI.transfer(0x01);
    int high = SPI.transfer(0x80 | (channel << 4));
    int low = SPI.transfer(0x00);
    digitalWrite(CS_PIN, HIGH);
    return ((high & 0x03) << 8) | low;
}

void setup()
{
    Serial.begin(115200);
    SPI.begin();
    pinMode(CS_PIN, OUTPUT);
    digitalWrite(CS_PIN, HIGH);
}

void loop()
{
    Serial.println(readMcp3008(0));
    delay(1000);
}
```

#### Testes Obrigatórios

- [ ] JSON válido em `tests/fixtures/json-files.test.ts`.
- [ ] Manifest respeita `docs/component-contract.md`.
- [ ] Componente com `visual.palette` aparece na UI.
- [ ] `visual.terminals` bate com `terminals`.
- [ ] Exemplo contém microcontrolador, MCP3008 e Analog Voltage Source.
- [ ] Firmware do exemplo compila pelo caminho WASM.
- [ ] Shim/runtime WASM suporta subset mínimo de `SPI`.
- [ ] Runtime registra dispositivo SPI por CS.
- [ ] Runtime converte tensão de CH0 em leitura 10-bit.
- [ ] Alterar tensão da fonte analógica não reinicia o tempo virtual.
- [ ] Inspector mostra valor bruto, tensão e status SPI.

#### Critérios de Aceite

- [ ] MCP3008 aparece em `Electronic/ADCs`.
- [ ] Pode ser adicionado ao board.
- [ ] Terminais VDD/VREF/GND/SPI/CH0 conectam corretamente.
- [ ] Exemplo carrega pelo modal `Exemplos`.
- [ ] Firmware compila em WASM.
- [ ] `read(0)` reflete a fonte analógica com escala 10-bit.
- [ ] Testes passam com `npm test`.

#### Fora de Escopo

- Todos os modos SPI avançados.
- Taxa de clock realista com temporização exata.
- Leitura diferencial completa na primeira entrega.
- Ruído e erro real de quantização.
- Múltiplos MCP3008 no mesmo barramento na primeira entrega.

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

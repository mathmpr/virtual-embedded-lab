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

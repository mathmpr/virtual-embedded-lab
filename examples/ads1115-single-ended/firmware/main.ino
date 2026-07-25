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

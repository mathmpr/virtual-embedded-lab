#include <DHT.h>

#define DHT_PIN 2
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);

void setup()
{
    Serial.begin(115200);
    dht.begin();
    Serial.println("DHT22 ready");
}

void loop()
{
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (isnan(humidity) || isnan(temperature)) {
        Serial.println("DHT read failed");
        delay(2000);
        return;
    }

    Serial.print("Humidity %: ");
    Serial.println(humidity);
    Serial.print("Temperature C: ");
    Serial.println(temperature);
    delay(2000);
}

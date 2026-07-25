const int LIGHT_PIN = A0;

void setup()
{
    Serial.begin(115200);
    pinMode(LIGHT_PIN, INPUT);
    Serial.println("LDR light sensor ready");
}

void loop()
{
    const int lightValue = analogRead(LIGHT_PIN);

    Serial.print("LIGHT RAW: ");
    Serial.println(lightValue);

    if (lightValue < 300) {
        Serial.println("DARK");
    } else if (lightValue < 700) {
        Serial.println("DIM");
    } else {
        Serial.println("BRIGHT");
    }

    delay(1000);
}

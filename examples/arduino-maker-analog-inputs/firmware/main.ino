const int POT_PIN = A0;
const int LM35_PIN = A1;
const int SOIL_PIN = A2;

float rawToVolts(int raw)
{
    return raw * 5.0 / 1023.0;
}

void setup()
{
    Serial.begin(115200);
    pinMode(POT_PIN, INPUT);
    pinMode(LM35_PIN, INPUT);
    pinMode(SOIL_PIN, INPUT);
    Serial.println("Maker analog inputs ready");
}

void loop()
{
    const int potRaw = analogRead(POT_PIN);
    const int lm35Raw = analogRead(LM35_PIN);
    const int soilRaw = analogRead(SOIL_PIN);

    const float potVolts = rawToVolts(potRaw);
    const float lm35Volts = rawToVolts(lm35Raw);
    const float soilVolts = rawToVolts(soilRaw);
    const float temperatureC = lm35Volts * 100.0;

    Serial.print("POT raw: ");
    Serial.print(potRaw);
    Serial.print(" volts: ");
    Serial.println(potVolts);

    Serial.print("LM35 C: ");
    Serial.println(temperatureC);

    Serial.print("SOIL raw: ");
    Serial.print(soilRaw);
    Serial.print(" volts: ");
    Serial.println(soilVolts);

    delay(1000);
}

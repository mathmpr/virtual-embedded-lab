const int RAIN_PIN = 7;

void setup()
{
    Serial.begin(115200);
    pinMode(RAIN_PIN, INPUT);
    Serial.println("FC-37 rain sensor ready");
}

void loop()
{
    const int rainState = digitalRead(RAIN_PIN);

    if (rainState == LOW) {
        Serial.println("RAIN DETECTED");
    } else {
        Serial.println("NO RAIN");
    }

    delay(1000);
}

const int BUZZER_PIN = 8;
bool buzzing = false;

void setup()
{
    Serial.begin(115200);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("Buzzer beep ready");
}

void loop()
{
    buzzing = !buzzing;
    digitalWrite(BUZZER_PIN, buzzing ? HIGH : LOW);

    if (buzzing) {
        Serial.println("Buzzer ON");
    } else {
        Serial.println("Buzzer OFF");
    }

    delay(500);
}

const int LED_PIN = 4;
int counter = 0;

void setup()
{
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    Serial.println("ESP32-C3 LED blink ready");
}

void loop()
{
    counter++;
    Serial.print("blink cycle: ");
    Serial.println(counter);

    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
}

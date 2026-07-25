const int BUTTON_PIN = 2;
const int LED_PIN = 13;
bool ledOn = false;
bool lastButtonState = false;

void setup()
{
    Serial.begin(115200);
    pinMode(BUTTON_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    Serial.println("Pull-up button toggle ready");
}

void loop()
{
    const bool buttonPressed = digitalRead(BUTTON_PIN) == HIGH;

    if (buttonPressed && !lastButtonState) {
        ledOn = !ledOn;
        digitalWrite(LED_PIN, ledOn ? HIGH : LOW);

        if (ledOn) {
            Serial.println("Blue LED ON");
        } else {
            Serial.println("Blue LED OFF");
        }
    }

    lastButtonState = buttonPressed;
    delay(20);
}

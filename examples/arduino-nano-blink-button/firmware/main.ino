const int BUTTON_PIN = 2;
const int LED_PIN = 9;
bool ledOn = false;
bool lastPressed = false;

void setup()
{
    Serial.begin(115200);
    pinMode(BUTTON_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(LED_BUILTIN, LOW);
    Serial.println("Nano ready");
}

void loop()
{
    bool pressed = digitalRead(BUTTON_PIN) == HIGH;

    if (pressed && !lastPressed) {
        ledOn = !ledOn;
        digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
        digitalWrite(LED_BUILTIN, ledOn ? HIGH : LOW);
        Serial.println(ledOn ? "Nano LED ON" : "Nano LED OFF");
    }

    lastPressed = pressed;
    delay(100);
}

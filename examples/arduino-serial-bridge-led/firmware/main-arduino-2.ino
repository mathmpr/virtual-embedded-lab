const int LED_PIN = 13;
char command[8];
int commandLength = 0;
bool ledOn = false;

bool commandEquals(const char *expected)
{
    int index = 0;

    while (expected[index] != 0 && command[index] != 0) {
        if (expected[index] != command[index]) {
            return false;
        }

        index++;
    }

    return expected[index] == 0 && command[index] == 0;
}

void clearCommand()
{
    for (int index = 0; index < 8; index++) {
        command[index] = 0;
    }

    commandLength = 0;
}

void toggleLed()
{
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);

    if (ledOn) {
        Serial.println("LED ON");
    } else {
        Serial.println("LED OFF");
    }
}

void handleCommand()
{
    if (commandEquals("pong")) {
        toggleLed();
        clearCommand();
    }
}

void setup()
{
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    clearCommand();
}

void loop()
{
    while (Serial.available() > 0) {
        const int incoming = Serial.read();

        if (incoming == 10 || incoming == 13) {
            clearCommand();
            continue;
        }

        if (commandLength < 7) {
            command[commandLength] = (char) incoming;
            commandLength++;
            command[commandLength] = 0;
            handleCommand();
        } else {
            clearCommand();
        }
    }

    delay(10);
}

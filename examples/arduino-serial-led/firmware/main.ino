const int LED_PIN = 13;
char command[8];
int commandLength = 0;

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

void handleCommand()
{
    if (commandEquals("on")) {
        digitalWrite(LED_PIN, HIGH);
        Serial.println("LED ON");
        clearCommand();
        return;
    }

    if (commandEquals("off")) {
        digitalWrite(LED_PIN, LOW);
        Serial.println("LED OFF");
        clearCommand();
        return;
    }
}

void flushUnknownCommand()
{
    if (commandLength > 0) {
        Serial.print("Unknown command: ");
        Serial.println(command);
    }

    clearCommand();
}

void setup()
{
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    clearCommand();

    Serial.println("Arduino Serial LED ready");
    Serial.println("Send on or off");
}

void loop()
{
    while (Serial.available() > 0) {
        const int incoming = Serial.read();

        if (incoming == 10 || incoming == 13) {
            flushUnknownCommand();
            continue;
        }

        if (commandLength < 7) {
            command[commandLength] = (char) incoming;
            commandLength++;
            command[commandLength] = 0;
            handleCommand();
        } else {
            flushUnknownCommand();
        }
    }

    delay(10);
}

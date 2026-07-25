int counter = 0;

void setup()
{
    Serial.begin(115200);
    pinMode(PIN, OUTPUT);
    digitalWrite(PIN, LOW);
}

void loop()
{
    counter++;

    Serial.print("counter: ");
    Serial.println(counter);

    if (counter % 10 == 0) {
        Serial.println("multiple of 10 - LED ON");
        digitalWrite(PIN, HIGH);
        delay(4000);
        digitalWrite(PIN, LOW);
    }

    delay(250);
}

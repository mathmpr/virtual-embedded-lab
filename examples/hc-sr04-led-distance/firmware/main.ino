const int TRIGGER_PIN = 7;
const int ECHO_PIN = 6;
const int LED_PIN = 13;

void setup()
{
    Serial.begin(115200);
    Serial.println("Virtual Embedded Lab iniciado");

    pinMode(TRIGGER_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);

    digitalWrite(TRIGGER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
}

void loop()
{
    digitalWrite(TRIGGER_PIN, LOW);
    delayMicroseconds(2);

    digitalWrite(TRIGGER_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGGER_PIN, LOW);

    const unsigned long echoDuration = pulseIn(ECHO_PIN, HIGH, 30000);
    const float distanceCm = echoDuration / 58.0;

    if (echoDuration > 0 && distanceCm < 100.0) {
        digitalWrite(LED_PIN, HIGH);
        Serial.print("LED ON - distancia cm: ");
        Serial.println(distanceCm);
    } else {
        digitalWrite(LED_PIN, LOW);
        Serial.print("LED OFF - distancia cm: ");
        Serial.println(distanceCm);
    }

    delay(50);
}

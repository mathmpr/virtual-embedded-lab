const int PIR_PIN = 2;
const int TOUCH_PIN = 3;
const int TILT_PIN = 4;
const int VIBRATION_PIN = 5;
const int HALL_PIN = 6;
const int REED_PIN = 7;
const int IR_PIN = 8;
const int SWITCH_PIN = 9;

void setup()
{
    Serial.begin(115200);
    pinMode(PIR_PIN, INPUT);
    pinMode(TOUCH_PIN, INPUT);
    pinMode(TILT_PIN, INPUT);
    pinMode(VIBRATION_PIN, INPUT);
    pinMode(HALL_PIN, INPUT);
    pinMode(REED_PIN, INPUT);
    pinMode(IR_PIN, INPUT);
    pinMode(SWITCH_PIN, INPUT);
    pinMode(LED_BUILTIN, OUTPUT);
    Serial.println("Maker digital sensors ready");
}

void printState(const char *label, int pin)
{
    Serial.print(label);
    Serial.print(": ");
    Serial.println(digitalRead(pin) == HIGH ? "ON" : "OFF");
}

void loop()
{
    const bool alarm = digitalRead(PIR_PIN) == HIGH
        || digitalRead(TOUCH_PIN) == HIGH
        || digitalRead(TILT_PIN) == HIGH
        || digitalRead(VIBRATION_PIN) == HIGH
        || digitalRead(HALL_PIN) == HIGH
        || digitalRead(REED_PIN) == HIGH
        || digitalRead(IR_PIN) == HIGH
        || digitalRead(SWITCH_PIN) == HIGH;

    digitalWrite(LED_BUILTIN, alarm ? HIGH : LOW);

    printState("PIR", PIR_PIN);
    printState("TOUCH", TOUCH_PIN);
    printState("TILT", TILT_PIN);
    printState("VIBRATION", VIBRATION_PIN);
    printState("HALL", HALL_PIN);
    printState("REED", REED_PIN);
    printState("IR", IR_PIN);
    printState("SWITCH", SWITCH_PIN);

    delay(1000);
}

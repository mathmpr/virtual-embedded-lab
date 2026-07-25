#define FIRST_CONTROL_PIN 2
#define LAST_CONTROL_PIN 11

void setup() {
  Serial.begin(9600);

  for (int pin = FIRST_CONTROL_PIN; pin <= LAST_CONTROL_PIN; pin++) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }

  Serial.println("Maker switching gallery started");
}

void loop() {
  for (int pin = FIRST_CONTROL_PIN; pin <= LAST_CONTROL_PIN; pin++) {
    digitalWrite(pin, HIGH);
    Serial.print("Control pin HIGH: D");
    Serial.println(pin);
    delay(300);

    digitalWrite(pin, LOW);
    delay(100);
  }
}

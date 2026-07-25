const int LATCH_PIN = 8;
const int DATA_PIN = 11;
const int CLOCK_PIN = 12;

const byte digits[10] = {
    0b00111111,
    0b00000110,
    0b01011011,
    0b01001111,
    0b01100110,
    0b01101101,
    0b01111101,
    0b00000111,
    0b01111111,
    0b01101111
};

int digit = 0;

void setup()
{
    Serial.begin(115200);
    pinMode(LATCH_PIN, OUTPUT);
    pinMode(DATA_PIN, OUTPUT);
    pinMode(CLOCK_PIN, OUTPUT);
    digitalWrite(LATCH_PIN, LOW);
    Serial.println("74HC595 counter ready");
}

void loop()
{
    digitalWrite(LATCH_PIN, LOW);
    shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, digits[digit]);
    digitalWrite(LATCH_PIN, HIGH);

    Serial.print("Shift digit: ");
    Serial.println(digit);
    digit = (digit + 1) % 10;
    delay(1000);
}

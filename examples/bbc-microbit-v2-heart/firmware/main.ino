const int MATRIX_FIRST_PIN = 100;
const int MATRIX_PIXELS = 25;
int HEART_PIXELS[] = {
    101, 103,
    105, 106, 107, 108, 109,
    110, 111, 112, 113, 114,
    116, 117, 118,
    122
};

void clearDisplay()
{
    for (int pin = MATRIX_FIRST_PIN; pin < MATRIX_FIRST_PIN + MATRIX_PIXELS; pin++) {
        digitalWrite(pin, LOW);
    }
}

void drawHeart()
{
    clearDisplay();

    for (unsigned int index = 0; index < sizeof(HEART_PIXELS) / sizeof(HEART_PIXELS[0]); index++) {
        digitalWrite(HEART_PIXELS[index], HIGH);
    }
}

void setup()
{
    Serial.begin(115200);

    for (int pin = MATRIX_FIRST_PIN; pin < MATRIX_FIRST_PIN + MATRIX_PIXELS; pin++) {
        pinMode(pin, OUTPUT);
    }

    drawHeart();
    Serial.println("micro:bit heart ready");
}

void loop()
{
    drawHeart();
    delay(1000);
}

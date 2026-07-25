const int segmentPins[8] = {2, 3, 4, 5, 6, 7, 8, 9};
const int digitMap[10][8] = {
    {HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, LOW, LOW},
    {LOW, HIGH, HIGH, LOW, LOW, LOW, LOW, LOW},
    {HIGH, HIGH, LOW, HIGH, HIGH, LOW, HIGH, LOW},
    {HIGH, HIGH, HIGH, HIGH, LOW, LOW, HIGH, LOW},
    {LOW, HIGH, HIGH, LOW, LOW, HIGH, HIGH, LOW},
    {HIGH, LOW, HIGH, HIGH, LOW, HIGH, HIGH, LOW},
    {HIGH, LOW, HIGH, HIGH, HIGH, HIGH, HIGH, LOW},
    {HIGH, HIGH, HIGH, LOW, LOW, LOW, LOW, LOW},
    {HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, LOW},
    {HIGH, HIGH, HIGH, HIGH, LOW, HIGH, HIGH, LOW}
};
int digit = 0;

void displayDigit(int value)
{
    for (int index = 0; index < 8; index++) {
        digitalWrite(segmentPins[index], digitMap[value][index]);
    }
}

void setup()
{
    Serial.begin(115200);
    for (int index = 0; index < 8; index++) {
        pinMode(segmentPins[index], OUTPUT);
        digitalWrite(segmentPins[index], LOW);
    }
    Serial.println("7 segment ready");
}

void loop()
{
    displayDigit(digit);
    Serial.print("Digit: ");
    Serial.println(digit);
    digit = (digit + 1) % 10;
    delay(1000);
}

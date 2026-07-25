#include <Servo.h>

Servo servo;
const int SERVO_PIN = 9;
int index = 0;
const int positions[3] = {0, 90, 180};

void setup()
{
    Serial.begin(115200);
    servo.attach(SERVO_PIN);
    Serial.println("Servo ready");
}

void loop()
{
    int angle = positions[index];
    servo.write(angle);
    Serial.print("Servo angle: ");
    Serial.println(angle);
    index = (index + 1) % 3;
    delay(1000);
}

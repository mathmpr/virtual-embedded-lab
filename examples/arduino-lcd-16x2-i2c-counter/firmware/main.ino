#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
int counter = 0;

void setup()
{
    Serial.begin(115200);
    Wire.begin();
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("Virtual Lab");
    Serial.println("LCD ready");
}

void loop()
{
    lcd.setCursor(0, 1);
    lcd.print("Count: ");
    lcd.print(counter);
    Serial.print("LCD count: ");
    Serial.println(counter);
    counter++;
    delay(1000);
}

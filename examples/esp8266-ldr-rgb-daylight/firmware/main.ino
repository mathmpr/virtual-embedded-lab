const int LDR_PIN = 0;     // ESP8266 ADC0/A0 in the virtual runtime
const int RED_PIN = 5;     // D1 / GPIO5
const int GREEN_PIN = 4;   // D2 / GPIO4
const int BLUE_PIN = 14;   // D5 / GPIO14

int clampByte(int value) {
  if (value < 0) {
    return 0;
  }

  if (value > 255) {
    return 255;
  }

  return value;
}

int interpolate(int startValue, int endValue, int step, int span) {
  return startValue + (endValue - startValue) * step / span;
}

void colorFromLight(int raw, int &red, int &green, int &blue) {
  // raw alto = dia claro; raw baixo = ambiente escuro.
  // Escala: vermelho -> laranja -> amarelo -> verde -> azul.
  int level = raw * 4 * 255 / 1023;

  if (level < 255) {
    red = 0;
    green = interpolate(0, 80, level, 255);
    blue = 255;
  } else if (level < 2 * 255) {
    int step = level - 255;
    red = 0;
    green = interpolate(80, 255, step, 255);
    blue = interpolate(255, 0, step, 255);
  } else if (level < 3 * 255) {
    int step = level - 2 * 255;
    red = interpolate(255, 255, step, 255);
    green = 255;
    blue = 0;
  } else {
    int step = level - 3 * 255;
    red = 255;
    green = interpolate(255, 0, step, 255);
    blue = 0;
  }

  red = clampByte(red);
  green = clampByte(green);
  blue = clampByte(blue);
}

void setup() {
  Serial.begin(9600);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  Serial.println("ESP8266 LDR RGB daylight example started");
}

void loop() {
  int raw = analogRead(LDR_PIN);
  int red = 0;
  int green = 0;
  int blue = 0;

  colorFromLight(raw, red, green, blue);

  analogWrite(RED_PIN, red);
  analogWrite(GREEN_PIN, green);
  analogWrite(BLUE_PIN, blue);

  Serial.print("LDR raw=");
  Serial.print(raw);
  Serial.print(" RGB=");
  Serial.print(red);
  Serial.print(",");
  Serial.print(green);
  Serial.print(",");
  Serial.println(blue);

  delay(250);
}

void pinMode(int pin, int mode) { __vl_pinMode(pin, mode); }
void digitalWrite(int pin, int value) { __vl_digitalWrite(pin, value); }
int digitalRead(int pin) { return __vl_digitalRead(pin); }
int analogRead(int pin) { return __vl_analogRead(pin); }
void delay(unsigned long milliseconds) { __vl_delay(milliseconds); }
void delayMicroseconds(unsigned long microseconds) { __vl_delayMicroseconds(microseconds); }
unsigned long pulseIn(int pin, int value, unsigned long timeout = 1000000) { return __vl_pulseIn(pin, value, timeout); }
unsigned long millis() { return __vl_millis(); }
unsigned long micros() { return __vl_micros(); }
unsigned long __vl_random_state = 1;

void shiftOut(int dataPin, int clockPin, int bitOrder, int value) {
  for (int index = 0; index < 8; index++) {
    int bit = bitOrder == LSBFIRST ? index : 7 - index;
    digitalWrite(dataPin, (value & (1 << bit)) ? HIGH : LOW);
    digitalWrite(clockPin, HIGH);
    digitalWrite(clockPin, LOW);
  }
}

void tone(int pin, int frequency) { __vl_tone(pin, frequency); }
void noTone(int pin) { __vl_noTone(pin); }
void randomSeed(unsigned long seed) { __vl_random_state = seed ? seed : 1; }

long random(long max) {
  __vl_random_state += 0x9e3779b9UL;
  unsigned long mixed = __vl_random_state;
  mixed = (mixed ^ (mixed >> 16)) * 0x85ebca6bUL;
  mixed = (mixed ^ (mixed >> 13)) * 0xc2b2ae35UL;
  mixed = mixed ^ (mixed >> 16);
  return max <= 0 ? 0 : (long)(mixed % (unsigned long)max);
}

long random(long min, long max) {
  if (max <= min) {
    return min;
  }
  return min + random(max - min);
}

void yield() {}
int digitalPinToInterrupt(int pin) { return pin; }
void attachInterrupt(int, void (*)(), int) {}
bool isnan(double value) { return value != value; }

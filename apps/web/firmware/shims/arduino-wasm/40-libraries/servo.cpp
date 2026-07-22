class Servo {
public:
  Servo() : pin(-1), attached(false) {}
  int attach(int requestedPin) {
    pin = requestedPin;
    attached = __vl_servoAttach(pin);
    return attached ? 1 : 0;
  }
  void write(int angle) {
    if (attached) {
      __vl_servoWrite(pin, angle);
    }
  }
  void writeMicroseconds(int pulseUs) {
    if (attached) {
      __vl_servoWriteMicroseconds(pin, pulseUs);
    }
  }
private:
  int pin;
  bool attached;
};

class TwoWire {
public:
  void begin() { __vl_wireBegin(); }
  void beginTransmission(int address) { __vl_wireBeginTransmission(address); }
  int write(int value) { return __vl_wireWrite(value); }
  int endTransmission() { return __vl_wireEndTransmission(); }
  int requestFrom(int address, int count) { return __vl_wireRequestFrom(address, count); }
  int available() { return __vl_wireAvailable(); }
  int read() { return __vl_wireRead(); }
};

TwoWire Wire;

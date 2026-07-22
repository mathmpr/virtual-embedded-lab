class HardwareSerial {
public:
  void begin(unsigned long baudRate) { __vl_serialBegin(baudRate); }
  void print(const char *value) { __vl_serialPrint(value); }
  void print(char value) { __vl_serialWrite((int)value); }
  void print(int value) { __vl_serialPrintInt(value); }
  void print(long value) { __vl_serialPrintInt((int)value); }
  void print(unsigned long value) { __vl_serialPrintInt((int)value); }
  void print(float value) { __vl_serialPrintFloat((double)value); }
  void print(double value) { __vl_serialPrintFloat(value); }
  void println() { __vl_serialPrintln(""); }
  void println(const char *value) { __vl_serialPrintln(value); }
  void println(char value) { __vl_serialWrite((int)value); __vl_serialPrintln(""); }
  void println(int value) { __vl_serialPrintlnInt(value); }
  void println(long value) { __vl_serialPrintlnInt((int)value); }
  void println(unsigned long value) { __vl_serialPrintlnInt((int)value); }
  void println(float value) { __vl_serialPrintlnFloat((double)value); }
  void println(double value) { __vl_serialPrintlnFloat(value); }
  void write(int value) { __vl_serialWrite(value); }
  int available() { return __vl_serialAvailable(); }
  int read() { return __vl_serialRead(); }
};

HardwareSerial Serial;

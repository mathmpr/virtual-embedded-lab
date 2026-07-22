class LiquidCrystal_I2C {
public:
  LiquidCrystal_I2C(int requestedAddress, int requestedColumns, int requestedRows)
    : address(requestedAddress), columns(requestedColumns), rows(requestedRows), initialized(false) {}
  void init() { initialized = __vl_lcdBegin(address, columns, rows); }
  void begin() { init(); }
  void begin(int requestedColumns, int requestedRows) {
    columns = requestedColumns;
    rows = requestedRows;
    init();
  }
  void backlight() { __vl_lcdBacklight(address, true); }
  void noBacklight() { __vl_lcdBacklight(address, false); }
  void setCursor(int column, int row) { __vl_lcdSetCursor(address, column, row); }
  void clear() { __vl_lcdClear(address); }
  void print(const char *value) { __vl_lcdPrint(address, value); }
  void print(char value) {
    char text[2] = { value, 0 };
    __vl_lcdPrint(address, text);
  }
  void print(int value) { __vl_lcdPrintInt(address, value); }
  void print(long value) { __vl_lcdPrintInt(address, (int)value); }
  void print(unsigned long value) { __vl_lcdPrintInt(address, (int)value); }
  void print(String value) { __vl_lcdPrint(address, value.c_str()); }
private:
  int address;
  int columns;
  int rows;
  bool initialized;
};

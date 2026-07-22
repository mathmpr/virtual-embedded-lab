class SPIClass {
public:
  void begin() { __vl_spiBegin(); }
  int transfer(int value) { return __vl_spiTransfer(value); }
};

SPIClass SPI;

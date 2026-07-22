class BMP280 {
public:
  BMP280() : address(0x76), initialized(false) {}
  bool begin(int requestedAddress = 0x76) {
    address = requestedAddress;
    initialized = __vl_bmp280Begin(address);
    return initialized;
  }
  double readTemperature() { return initialized ? __vl_bmp280ReadTemperature(address) : 0; }
  double readPressure() { return initialized ? __vl_bmp280ReadPressure(address) : 0; }
private:
  int address;
  bool initialized;
};

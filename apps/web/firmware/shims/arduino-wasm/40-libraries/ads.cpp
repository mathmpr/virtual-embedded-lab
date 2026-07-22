const int __VL_ADC_ADS1015 = 1015;
const int __VL_ADC_ADS1115 = 1115;

class ADS1015 {
public:
  ADS1015() : address(0x48), initialized(false) {}
  bool begin(int requestedAddress = 0x48) {
    address = requestedAddress;
    initialized = __vl_adcBegin(address, __VL_ADC_ADS1015);
    return initialized;
  }
  int readADC_SingleEnded(int channel) { return initialized ? __vl_adcReadSingleEnded(address, channel) : 0; }
  double computeVolts(int raw) { return initialized ? __vl_adcComputeVolts(address, raw) : 0; }
private:
  int address;
  bool initialized;
};

class ADS1115 {
public:
  ADS1115() : address(0x48), initialized(false) {}
  bool begin(int requestedAddress = 0x48) {
    address = requestedAddress;
    initialized = __vl_adcBegin(address, __VL_ADC_ADS1115);
    return initialized;
  }
  int readADC_SingleEnded(int channel) { return initialized ? __vl_adcReadSingleEnded(address, channel) : 0; }
  double computeVolts(int raw) { return initialized ? __vl_adcComputeVolts(address, raw) : 0; }
private:
  int address;
  bool initialized;
};

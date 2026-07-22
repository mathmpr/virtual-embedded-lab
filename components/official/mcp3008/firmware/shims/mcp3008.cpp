class MCP3008 {
public:
  MCP3008() : chipSelectPin(10), initialized(false) {}
  bool begin(int requestedChipSelectPin = 10) {
    chipSelectPin = requestedChipSelectPin;
    initialized = __vl_mcp3008Begin(chipSelectPin);
    return initialized;
  }
  int read(int channel) { return initialized ? __vl_mcp3008Read(chipSelectPin, channel) : 0; }
private:
  int chipSelectPin;
  bool initialized;
};

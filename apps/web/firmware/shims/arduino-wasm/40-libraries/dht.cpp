class DHT {
public:
  DHT(int requestedPin, int requestedType) : pin(requestedPin), type(requestedType), initialized(false) {}
  void begin() { initialized = __vl_dhtBegin(pin, type); }
  float readTemperature() { return initialized ? (float)__vl_dhtReadTemperature(pin, type) : 0.0f; }
  float readHumidity() { return initialized ? (float)__vl_dhtReadHumidity(pin, type) : 0.0f; }
private:
  int pin;
  int type;
  bool initialized;
};

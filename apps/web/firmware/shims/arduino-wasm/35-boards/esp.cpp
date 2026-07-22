class WiFiEventHandler {};
class WiFiEventStationModeGotIP {};
class WiFiEventStationModeDisconnected {};

class ESPClass {
public:
  void restart() {}
  void wdtDisable() {}
  void wdtEnable(int) {}
  void wdtFeed() {}
};

ESPClass ESP;
const int WDTO_8S = 8000;

const int WIFI_STA = 1;
const int WIFI_AP = 2;
const int WIFI_AP_STA = 3;
const int WL_IDLE_STATUS = 0;
const int WL_NO_SSID_AVAIL = 1;
const int WL_SCAN_COMPLETED = 2;
const int WL_CONNECTED = 3;
const int WL_CONNECT_FAILED = 4;
const int WL_CONNECTION_LOST = 5;
const int WL_DISCONNECTED = 6;

class WiFiClass {
public:
  void mode(int mode) { __vl_wifiMode(mode); }
  int begin(const char *ssid) { return __vl_wifiBegin(ssid, ""); }
  int begin(const char *ssid, const char *password) { return __vl_wifiBegin(ssid, password); }
  int status() { return __vl_wifiStatus(); }
  bool softAP(const char *ssid) { return __vl_wifiSoftAP(ssid, ""); }
  bool softAP(const char *ssid, const char *password) { return __vl_wifiSoftAP(ssid, password); }
  int scanNetworks() { return __vl_wifiScanNetworks(); }
  int RSSI() { return __vl_wifiRssi(); }
  int RSSI(const char *ssid) { return __vl_wifiRssiForSsid(ssid); }
  bool internetAvailable() { return __vl_wifiInternetAvailable(); }
  void disconnect() {}
  void setAutoReconnect(bool) {}
  void persistent(bool) {}
  void scanDelete() {}
  String SSID(int) { return String("VirtualLab"); }
};

WiFiClass WiFi;

class WiFiClient {
public:
  int connect(const char *host, int port) { return __vl_tcpConnect(host, port); }
  int print(const char *value) { return __vl_tcpPrint(value); }
  int println() { return __vl_tcpPrintln(""); }
  int println(const char *value) { return __vl_tcpPrintln(value); }
  int available() { return __vl_tcpAvailable(); }
  int read() { return __vl_tcpRead(); }
  void stop() { __vl_tcpStop(); }
  int connected() { return __vl_tcpConnected(); }
};

enum AsyncMqttClientDisconnectReason {
  TCP_DISCONNECTED = 0,
  MQTT_UNACCEPTABLE_PROTOCOL_VERSION = 1,
  MQTT_IDENTIFIER_REJECTED = 2,
  MQTT_SERVER_UNAVAILABLE = 3,
  MQTT_MALFORMED_CREDENTIALS = 4,
  MQTT_NOT_AUTHORIZED = 5
};

struct AsyncMqttClientMessageProperties {
  bool dup;
  unsigned char qos;
  bool retain;
};

class AsyncMqttClient {
public:
  AsyncMqttClient() : connectCallback(0), disconnectCallback(0), messageCallback(0), subscriptionCount(0) {}
  void setServer(const char *host, unsigned short port) { __vl_mqttSetServer(host, port); }
  void onConnect(void (*callback)(bool)) { connectCallback = callback; }
  void onDisconnect(void (*callback)(AsyncMqttClientDisconnectReason)) { disconnectCallback = callback; }
  void onMessage(void (*callback)(char *, char *, AsyncMqttClientMessageProperties, size_t, size_t, size_t)) { messageCallback = callback; }
  void connect() {
    if (__vl_mqttConnect() && connectCallback) {
      connectCallback(false);
    }
  }
  void disconnect() {
    __vl_mqttDisconnect();
    if (disconnectCallback) {
      disconnectCallback(TCP_DISCONNECTED);
    }
  }
  bool connected() {
    bool active = __vl_mqttConnected();
    if (active) {
      pollMessages();
    }
    return active;
  }
  unsigned short subscribe(const char *topic, unsigned char qos) {
    unsigned short packetId = __vl_mqttSubscribe(topic, qos);
    if (subscriptionCount < 8) {
      copySubscription(subscriptionCount, topic);
      subscriptionCount++;
    }
    pollMessages();
    return packetId;
  }
  unsigned short publish(const char *topic, unsigned char qos, bool retain, const char *payload) {
    unsigned short packetId = __vl_mqttPublish(topic, qos, retain, payload);
    pollMessages();
    return packetId;
  }
private:
  void (*connectCallback)(bool);
  void (*disconnectCallback)(AsyncMqttClientDisconnectReason);
  void (*messageCallback)(char *, char *, AsyncMqttClientMessageProperties, size_t, size_t, size_t);
  char subscriptions[8][128];
  int subscriptionCount;
  void copySubscription(int slot, const char *topic) {
    int index = 0;
    while (topic && topic[index] != 0 && index < 127) {
      subscriptions[slot][index] = topic[index];
      index++;
    }
    subscriptions[slot][index] = 0;
  }
  void pollMessages() {
    for (int index = 0; index < subscriptionCount; index++) {
      for (int attempt = 0; attempt < 16; attempt++) {
        if (!deliverSubscribedMessage(subscriptions[index])) {
          break;
        }
      }
    }
  }
  bool deliverSubscribedMessage(const char *subscription) {
    if (!messageCallback) {
      return false;
    }
    char topic[128];
    char payload[256];
    int length = __vl_mqttReadMessage(subscription, topic, 128, payload, 256);
    if (length >= 0) {
      AsyncMqttClientMessageProperties properties = { false, 0, false };
      messageCallback(topic, payload, properties, (size_t)length, 0, (size_t)length);
      return true;
    }
    return false;
  }
};

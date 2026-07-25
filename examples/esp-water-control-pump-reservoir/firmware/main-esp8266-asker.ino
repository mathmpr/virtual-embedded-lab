#include <ESP8266WiFi.h>
#include <AsyncMqttClient.h>
#include <SimpleTimer.h>

// This example mirrors the real water-control project broker/API contract.
// MQTT topics, payload format and tokens are expected to match:
// https://github.com/mathmpr/water-control

#define LED_PIN 2
#define SSR_PIN 14

AsyncMqttClient mqttClient;
SimpleTimer keepAliveTimer;
SimpleTimer mqttConnectTimer;
SimpleTimer mqttPollTimer;

bool connected = false;
bool mqttConnected = false;
bool enabledWaterPump = false;
char payload[96];

const char *toggleWaterTopic = "toggle/water";
const char *onOffWaterTopic = "on_off/water";
const char *keepAliveTopic = "keep/alive";
const char *mqttServer = "192.168.200.70";
const uint16_t mqttPort = 1883;
const char *askerSecretKey = "ASKER_SECRET_KEY";
const char *iam = "asker";

void publishStatus(bool status, const char *type)
{
    snprintf(payload, sizeof(payload), "%s:%s:%s:%s", askerSecretKey, iam, type, status ? "1" : "0");
    mqttClient.publish(onOffWaterTopic, 0, false, payload);
}

void toggleWaterPump(bool status)
{
    enabledWaterPump = status;
    digitalWrite(SSR_PIN, enabledWaterPump ? LOW : HIGH);
    Serial.println(enabledWaterPump ? "Pump ON" : "Pump OFF");
    publishStatus(status, "mqtt");
}

void pollMqtt()
{
    if (mqttConnected) {
        mqttClient.connected();
    }
}

void publishKeepAlive()
{
    if (mqttClient.connected()) {
        snprintf(payload, sizeof(payload), "%s:%s", askerSecretKey, iam);
        mqttClient.publish(keepAliveTopic, 0, false, payload);
        Serial.println("asker keepalive");
    }
}

void connectMqtt()
{
    if (connected && !mqttConnected) {
        mqttClient.connect();
    }
}

void onMqttConnect(bool sessionPresent)
{
    mqttConnected = true;
    digitalWrite(LED_PIN, LOW);
    Serial.println("asker MQTT connected");
    mqttClient.subscribe(toggleWaterTopic, 0);
    publishKeepAlive();
}

void onMqttDisconnect(AsyncMqttClientDisconnectReason reason)
{
    mqttConnected = false;
    digitalWrite(LED_PIN, HIGH);
}

void onMqttMessage(char *topic, char *data, AsyncMqttClientMessageProperties properties, size_t len, size_t index, size_t total)
{
    if (topic[0] == 't') {
        toggleWaterPump(len > 0 && data[0] == '1');
    }
}

void setup()
{
    Serial.begin(9600);
    pinMode(LED_PIN, OUTPUT);
    pinMode(SSR_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(SSR_PIN, HIGH);

    WiFi.mode(WIFI_STA);
    WiFi.begin("VirtualLab", "secret");
    connected = WiFi.status() == WL_CONNECTED && WiFi.internetAvailable();
    Serial.println(connected ? "asker Wi-Fi connected" : "asker Wi-Fi disconnected");

    mqttClient.onConnect(onMqttConnect);
    mqttClient.onDisconnect(onMqttDisconnect);
    mqttClient.onMessage(onMqttMessage);
    mqttClient.setServer(mqttServer, mqttPort);

    keepAliveTimer.setInterval(8300, publishKeepAlive);
    mqttConnectTimer.setInterval(5700, connectMqtt);
    mqttPollTimer.setInterval(1000, pollMqtt);
    connectMqtt();
}

void loop()
{
    keepAliveTimer.run();
    mqttConnectTimer.run();
    mqttPollTimer.run();
    delay(1000);
}

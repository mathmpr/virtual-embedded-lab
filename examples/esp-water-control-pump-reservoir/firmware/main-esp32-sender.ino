#include <WiFi.h>
#include <AsyncMqttClient.h>
#include <SimpleTimer.h>

// This example mirrors the real water-control project broker/API contract.
// MQTT topics, payload format and tokens are expected to match:
// https://github.com/mathmpr/water-control

#define LED_BUILTIN 2

AsyncMqttClient mqtt;
SimpleTimer waterDetectTimer;
SimpleTimer waterIncomeTimer;
SimpleTimer keepAliveTimer;
SimpleTimer mqttConnectTimer;

bool connected = false;
bool mqttConnected = false;
char payload[96];

const char *detectWaterTopic = "detect/water";
const char *incomeWaterTopic = "income/water";
const char *keepAliveTopic = "keep/alive";
const char *mqttServer = "192.168.200.70";
const uint16_t mqttPort = 1883;
const char *senderSecretKey = "SENDER_SECRET_KEY";
const char *iam = "sender";

const int waterDetectSensor = 34;
const int waterIncomeSensor = 35;
int sendDetectAt = 300;
int sendIncomeAt = 250;

void connectMqtt()
{
    if (connected && !mqttConnected) {
        mqtt.connect();
    }
}

int readAvg(int pin)
{
    long sum = 0;

    for (int index = 0; index < 16; index++) {
        sum += analogRead(pin);
        delayMicroseconds(2);
    }

    return (int)(sum / 16);
}

void publishSensor(const char *topic, int value, const char *label)
{
    snprintf(payload, sizeof(payload), "%s:%s:%d", senderSecretKey, iam, value);
    mqtt.publish(topic, 0, false, payload);
    Serial.print("sender publish ");
    Serial.println(label);
}

void detectWater()
{
    int value = readAvg(waterDetectSensor) / 4;
    Serial.print("Detect: ");
    Serial.println(value);

    if (mqttConnected && value > sendDetectAt) {
        publishSensor(detectWaterTopic, value, "detect/water");
    }
}

void incomeWater()
{
    int value = readAvg(waterIncomeSensor) / 4;
    Serial.print("Income: ");
    Serial.println(value);

    if (mqttConnected && value > sendIncomeAt) {
        publishSensor(incomeWaterTopic, value, "income/water");
    }
}

void keepAlive()
{
    if (mqttConnected) {
        snprintf(payload, sizeof(payload), "%s:%s", senderSecretKey, iam);
        mqtt.publish(keepAliveTopic, 0, false, payload);
        Serial.println("sender keepalive");
    }
}

void onMqttConnect(bool sessionPresent)
{
    mqttConnected = true;
    digitalWrite(LED_BUILTIN, HIGH);
    Serial.println("sender MQTT connected");
}

void onMqttDisconnect(AsyncMqttClientDisconnectReason reason)
{
    mqttConnected = false;
    digitalWrite(LED_BUILTIN, LOW);
}

void setup()
{
    Serial.begin(9600);
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);

    WiFi.mode(WIFI_STA);
    WiFi.begin("VirtualLab", "secret");
    connected = WiFi.status() == WL_CONNECTED && WiFi.internetAvailable();
    Serial.println(connected ? "sender Wi-Fi connected" : "sender Wi-Fi disconnected");

    mqtt.setServer(mqttServer, mqttPort);
    mqtt.onConnect(onMqttConnect);
    mqtt.onDisconnect(onMqttDisconnect);

    waterDetectTimer.setInterval(5000, detectWater);
    waterIncomeTimer.setInterval(16500, incomeWater);
    keepAliveTimer.setInterval(8300, keepAlive);
    mqttConnectTimer.setInterval(7450, connectMqtt);
    connectMqtt();
}

void loop()
{
    waterDetectTimer.run();
    waterIncomeTimer.run();
    keepAliveTimer.run();
    mqttConnectTimer.run();
    delay(1000);
}

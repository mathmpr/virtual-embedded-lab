#include <WiFi.h>

void setup()
{
    Serial.begin(115200);
    Serial.println("ESP32 Wi-Fi Signal example");

    WiFi.mode(WIFI_STA);
    WiFi.begin("VirtualLab", "secret");

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Wi-Fi connected");
        Serial.print("RSSI dBm: ");
        Serial.println(WiFi.RSSI());
    } else {
        Serial.println("Wi-Fi disconnected");
    }
}

void loop()
{
    Serial.print("RSSI dBm: ");
    Serial.println(WiFi.RSSI());
    delay(1000);
}

#include <WiFi.h>

WiFiClient client;

const char *SSID = "VirtualLab";
const char *PASSWORD = "secret";
const char *HOST = "jsonplaceholder.typicode.com";
const int HTTPS_PORT = 443;
int headerState = 0;

void trackHeaderEnd(int value)
{
    if ((headerState == 0 || headerState == 2) && value == 13) {
        headerState++;
        return;
    }

    if ((headerState == 1 || headerState == 3) && value == 10) {
        headerState++;
        return;
    }

    headerState = value == 13 ? 1 : 0;
}

void setup()
{
    Serial.begin(115200);
    Serial.println("ESP32 TCP JSONPlaceholder example");

    WiFi.mode(WIFI_STA);
    WiFi.begin(SSID, PASSWORD);

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi disconnected");
        return;
    }

    if (!WiFi.internetAvailable()) {
        Serial.println("Wi-Fi connected without internet");
        return;
    }

    Serial.println("Wi-Fi connected with internet");

    if (!client.connect(HOST, HTTPS_PORT)) {
        Serial.println("TCP connection failed");
        return;
    }

    Serial.println("TCP connected");
    client.println("GET /todos/1 HTTP/1.1");
    client.println("Host: jsonplaceholder.typicode.com");
    client.println("Connection: close");
    client.println();

    bool bodyStarted = false;

    while (client.connected() || client.available()) {
        while (client.available()) {
            int value = client.read();

            if (value < 0) {
                break;
            }

            if (!bodyStarted) {
                trackHeaderEnd(value);

                if (headerState >= 4) {
                    bodyStarted = true;
                }

                continue;
            }

            Serial.write(value);
        }
    }

    client.stop();
    Serial.println();
}

void loop()
{
    delay(1000);
}

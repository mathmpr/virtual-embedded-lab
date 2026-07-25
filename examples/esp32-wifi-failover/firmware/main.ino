#include <WiFi.h>

struct NetworkCandidate
{
    const char *ssid;
    const char *password;
};

NetworkCandidate networks[] = {
    {"Lab-Fiber", "secret"},
    {"Lab-Mesh", "secret"},
    {"Guest-IoT", "guest"}
};

const int NETWORK_COUNT = 3;
bool attempted[NETWORK_COUNT] = { false, false, false };
int selectedNetwork = -1;

int strongestPendingNetwork()
{
    int bestIndex = -1;
    int bestRssi = -1000;

    for (int index = 0; index < NETWORK_COUNT; index++) {
        if (attempted[index]) {
            continue;
        }

        int rssi = WiFi.RSSI(networks[index].ssid);

        if (rssi > bestRssi) {
            bestRssi = rssi;
            bestIndex = index;
        }
    }

    return bestIndex;
}

void connectBestNetworkWithInternet()
{
    WiFi.mode(WIFI_STA);
    Serial.print("Redes encontradas: ");
    Serial.println(WiFi.scanNetworks());

    for (int attempt = 0; attempt < NETWORK_COUNT; attempt++) {
        int candidate = strongestPendingNetwork();

        if (candidate < 0) {
            break;
        }

        attempted[candidate] = true;
        Serial.print("Tentando SSID: ");
        Serial.print(networks[candidate].ssid);
        Serial.print(" RSSI: ");
        Serial.println(WiFi.RSSI(networks[candidate].ssid));

        WiFi.begin(networks[candidate].ssid, networks[candidate].password);

        if (WiFi.status() == WL_CONNECTED && WiFi.internetAvailable()) {
            selectedNetwork = candidate;
            Serial.print("Internet ativa em: ");
            Serial.print(networks[candidate].ssid);
            Serial.print(" RSSI: ");
            Serial.println(WiFi.RSSI());
            return;
        }

        Serial.print("Sem internet em: ");
        Serial.println(networks[candidate].ssid);
    }

    Serial.println("Nenhuma rede com internet ativa.");
}

void setup()
{
    Serial.begin(115200);
    Serial.println("ESP32 Wi-Fi failover example");
    connectBestNetworkWithInternet();
}

void loop()
{
    if (selectedNetwork >= 0) {
        Serial.print("Conectado em: ");
        Serial.print(networks[selectedNetwork].ssid);
        Serial.print(" RSSI: ");
        Serial.println(WiFi.RSSI());
    } else {
        Serial.println("Offline");
    }

    delay(2000);
}

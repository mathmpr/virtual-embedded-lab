export function register(registry) {
  registry.register(wifiImportAdapter);
  registry.register(tcpClientImportAdapter);
  registry.register(mqttImportAdapter);
}

const wifiImportAdapter = {
  id: 'component-wifi',
  libraries: ['WiFi'],
  capabilities: ['wifi'],
  imports({ runtime, readCString }) {
    return {
      __vl_wifiMode(mode) {
        runtime.wifiMode(Number(mode));
      },
      __vl_wifiBegin(ssidPointer, passwordPointer) {
        return runtime.wifiBegin(readCString(ssidPointer), readCString(passwordPointer));
      },
      __vl_wifiStatus() {
        return runtime.wifiStatus();
      },
      __vl_wifiSoftAP(ssidPointer, passwordPointer) {
        return runtime.wifiSoftAp(readCString(ssidPointer), readCString(passwordPointer)) ? 1 : 0;
      },
      __vl_wifiScanNetworks() {
        return runtime.wifiScanNetworks();
      },
      __vl_wifiRssi() {
        return runtime.wifiRssi();
      },
      __vl_wifiRssiForSsid(ssidPointer) {
        return runtime.wifiRssiForSsid(readCString(ssidPointer));
      },
      __vl_wifiInternetAvailable() {
        return runtime.wifiInternetAvailable() ? 1 : 0;
      }
    };
  }
};

const tcpClientImportAdapter = {
  id: 'component-tcp-client',
  libraries: ['WiFiClient'],
  capabilities: ['tcp-client'],
  imports({ runtime, readCString }) {
    return {
      __vl_tcpConnect(hostPointer, port) {
        return runtime.tcpConnect(readCString(hostPointer), Number(port));
      },
      __vl_tcpPrint(dataPointer) {
        return runtime.tcpPrint(readCString(dataPointer));
      },
      __vl_tcpPrintln(dataPointer) {
        return runtime.tcpPrintln(readCString(dataPointer));
      },
      __vl_tcpAvailable() {
        return runtime.tcpAvailable();
      },
      __vl_tcpRead() {
        return runtime.tcpRead();
      },
      __vl_tcpStop() {
        runtime.tcpStop();
      },
      __vl_tcpConnected() {
        return runtime.tcpConnected();
      }
    };
  }
};

const mqttImportAdapter = {
  id: 'component-mqtt',
  libraries: ['AsyncMqttClient'],
  capabilities: ['mqtt-client'],
  imports({ runtime, readCString, writeCString }) {
    return {
      __vl_mqttSetServer(hostPointer, port) {
        runtime.mqttSetServer(readCString(hostPointer), Number(port));
      },
      __vl_mqttConnect() {
        return runtime.mqttConnect();
      },
      __vl_mqttDisconnect() {
        runtime.mqttDisconnect();
      },
      __vl_mqttConnected() {
        return runtime.mqttConnected();
      },
      __vl_mqttSubscribe(topicPointer, qos) {
        return runtime.mqttSubscribe(readCString(topicPointer), Number(qos));
      },
      __vl_mqttPublish(topicPointer, qos, retain, payloadPointer) {
        return runtime.mqttPublish(readCString(topicPointer), Number(qos), Boolean(retain), readCString(payloadPointer));
      },
      __vl_mqttReadMessage(subscribedTopicPointer, topicPointer, topicMax, payloadPointer, payloadMax) {
        const message = runtime.mqttReadSubscribedMessage(readCString(subscribedTopicPointer));

        if (!message) {
          return -1;
        }

        writeCString(topicPointer, Number(topicMax), message.topic);
        return writeCString(payloadPointer, Number(payloadMax), message.payload);
      }
    };
  }
};

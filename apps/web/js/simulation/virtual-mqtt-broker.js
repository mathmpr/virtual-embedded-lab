export function createVirtualMqttBroker(config = {}) {
  const brokers = normalizeBrokers(config);
  const sessions = new Map();
  const published = [];

  return {
    connect({ clientId, host, port }) {
      const broker = brokerFor({ brokers, host, port });
      const connected = Boolean(broker?.online);

      sessions.set(clientId, {
        clientId,
        host: String(host ?? ''),
        port: Number(port) || 1883,
        connected,
        subscriptions: new Set(),
        delivered: new Set()
      });

      return connected;
    },
    disconnect(clientId) {
      const session = sessions.get(clientId);

      if (session) {
        session.connected = false;
      }
    },
    connected(clientId) {
      return Boolean(sessions.get(clientId)?.connected);
    },
    subscribe(clientId, topic) {
      const session = sessions.get(clientId);

      if (!session?.connected) {
        return 0;
      }

      session.subscriptions.add(String(topic ?? ''));
      return nextPacketId();
    },
    publish({ clientId, topic, qos = 0, retain = false, payload = '' }) {
      const session = sessions.get(clientId);

      if (!session?.connected) {
        return 0;
      }

      published.push({
        clientId,
        topic: String(topic ?? ''),
        qos: Number(qos) || 0,
        retain: Boolean(retain),
        payload: String(payload ?? ''),
        direction: 'TX'
      });

      return nextPacketId();
    },
    readSubscribedMessage(clientId, subscribedTopic) {
      const session = sessions.get(clientId);

      if (!session?.connected) {
        return null;
      }

      const broker = brokerFor({ brokers, host: session.host, port: session.port });
      const topic = String(subscribedTopic ?? '');
      const message = (broker?.messages ?? []).find((item, index) => {
        const messageKey = `${index}:${item.topic}`;
        return !session.delivered.has(messageKey) && mqttTopicMatches(topic, item.topic);
      });

      if (!message) {
        return null;
      }

      const index = broker.messages.indexOf(message);
      session.delivered.add(`${index}:${message.topic}`);
      return {
        topic: message.topic,
        payload: String(message.payload ?? '')
      };
    },
    snapshot() {
      return {
        brokers: brokers.map((broker) => ({ ...broker, messages: broker.messages.map((message) => ({ ...message })) })),
        sessions: [...sessions.values()].map((session) => ({
          clientId: session.clientId,
          host: session.host,
          port: session.port,
          connected: session.connected,
          subscriptions: [...session.subscriptions]
        })),
        published: published.map((message) => ({ ...message }))
      };
    }
  };
}

let packetId = 1;

function nextPacketId() {
  packetId += 1;
  return packetId;
}

function normalizeBrokers(config = {}) {
  const entries = Object.entries(config.brokers ?? {});

  if (entries.length === 0) {
    return [
      {
        host: 'mqtt.local',
        port: 1883,
        online: true,
        messages: []
      }
    ];
  }

  return entries.map(([host, broker]) => ({
    host,
    port: Number(broker.port ?? 1883),
    online: broker.online !== false,
    messages: (broker.messages ?? []).map((message) => ({
      topic: String(message.topic ?? ''),
      payload: String(message.payload ?? '')
    }))
  }));
}

function brokerFor({ brokers, host, port }) {
  const normalizedHost = String(host ?? '').toLowerCase();
  const normalizedPort = Number(port) || 1883;

  return brokers.find((broker) => {
    return broker.host.toLowerCase() === normalizedHost && broker.port === normalizedPort;
  }) ?? null;
}

function mqttTopicMatches(subscription, topic) {
  const subscriptionParts = String(subscription ?? '').split('/');
  const topicParts = String(topic ?? '').split('/');

  for (let index = 0; index < subscriptionParts.length; index += 1) {
    const part = subscriptionParts[index];

    if (part === '#') {
      return true;
    }

    if (part !== '+' && part !== topicParts[index]) {
      return false;
    }
  }

  return subscriptionParts.length === topicParts.length;
}

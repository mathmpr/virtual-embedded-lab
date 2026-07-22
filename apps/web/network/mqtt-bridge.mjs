import mqtt from 'mqtt';

const clients = new Map();

export async function handleMqttBridgeRequest(pathname, request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' });
    response.end('Method not allowed');
    return true;
  }

  const payload = JSON.parse(await readRequestBody(request, 64 * 1024));
  const action = pathname.slice('/api/network/mqtt/'.length);

  try {
    const result = await routeMqttAction(action, payload);

    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      ok: false,
      error: error.message
    }));
  }

  return true;
}

async function routeMqttAction(action, payload) {
  if (action === 'connect') {
    return connectMqtt(payload);
  }

  if (action === 'disconnect') {
    return disconnectMqtt(payload);
  }

  if (action === 'connected') {
    return { connected: clientFor(payload.clientId)?.connected === true };
  }

  if (action === 'subscribe') {
    return subscribeMqtt(payload);
  }

  if (action === 'publish') {
    return publishMqtt(payload);
  }

  if (action === 'drain') {
    return drainMqtt(payload);
  }

  throw new Error(`Unsupported MQTT bridge action: ${action}`);
}

async function connectMqtt(payload) {
  const clientId = clientIdFromPayload(payload);
  const host = String(payload.host ?? '');
  const port = Number(payload.port ?? 1883);
  const url = `mqtt://${host}:${port}`;
  const existing = clients.get(clientId);

  if (existing?.client?.connected) {
    return { connected: true };
  }

  existing?.client?.end(true);

  const state = {
    clientId,
    client: mqtt.connect(url, {
      clientId: `virtual-lab-${clientId}`,
      reconnectPeriod: 0,
      connectTimeout: Number(payload.timeoutMs ?? 2000)
    }),
    connected: false,
    messages: []
  };

  clients.set(clientId, state);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`MQTT connection timeout: ${url}`));
    }, Number(payload.timeoutMs ?? 2000));

    function cleanup() {
      clearTimeout(timeout);
      state.client.off('connect', onConnect);
      state.client.off('error', onError);
    }

    function onConnect() {
      cleanup();
      state.connected = true;
      resolve();
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    state.client.once('connect', onConnect);
    state.client.once('error', onError);
  });

  state.client.on('message', (topic, message) => {
    console.info(`[mqtt-bridge] receive ${state.clientId} ${topic}: ${redactPayload(message.toString())}`);
    state.messages.push({
      topic,
      payload: message.toString()
    });
  });

  state.client.on('close', () => {
    state.connected = false;
  });

  console.info(`[mqtt-bridge] connected ${clientId} -> ${url}`);
  return { connected: true };
}

function disconnectMqtt(payload) {
  const state = clientFor(payload.clientId);

  state?.client?.end(true);
  clients.delete(clientIdFromPayload(payload));
  return { connected: false };
}

async function subscribeMqtt(payload) {
  const state = requireConnected(payload.clientId);
  const topic = String(payload.topic ?? '');

  await state.client.subscribeAsync(topic, { qos: Number(payload.qos ?? 0) || 0 });
  console.info(`[mqtt-bridge] subscribe ${payload.clientId ?? 'default'} ${topic}`);
  return { packetId: Date.now() & 0xffff };
}

async function publishMqtt(payload) {
  const state = requireConnected(payload.clientId);
  const topic = String(payload.topic ?? '');
  const message = String(payload.payload ?? '');

  await state.client.publishAsync(topic, message, {
    qos: Number(payload.qos ?? 0) || 0,
    retain: Boolean(payload.retain)
  });

  console.info(`[mqtt-bridge] publish ${payload.clientId ?? 'default'} ${topic}: ${redactPayload(message)}`);
  return { packetId: Date.now() & 0xffff };
}

function drainMqtt(payload) {
  const state = clientFor(payload.clientId);
  const topic = String(payload.topic ?? '');
  const messages = [];

  if (state) {
    const messageIndex = state.messages.findIndex((message) => mqttTopicMatches(topic, message.topic));

    if (messageIndex >= 0) {
      messages.push(state.messages[messageIndex]);
      state.messages.splice(messageIndex, 1);
    }
  }

  if (messages.length > 0) {
    console.info(`[mqtt-bridge] drain ${payload.clientId ?? 'default'} ${topic}: ${messages.length}`);
  }

  return { messages };
}

function requireConnected(clientId) {
  const state = clientFor(clientId);

  if (!state?.client?.connected) {
    throw new Error(`MQTT client is not connected: ${clientId}`);
  }

  return state;
}

function clientFor(clientId) {
  return clients.get(String(clientId ?? 'default')) ?? null;
}

function clientIdFromPayload(payload) {
  return String(payload.clientId ?? 'default');
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

function redactPayload(payload) {
  const value = String(payload ?? '');
  const separator = value.indexOf(':');

  if (separator < 0) {
    return value;
  }

  return `<redacted>${value.slice(separator)}`;
}

function readRequestBody(request, limitBytes) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > limitBytes) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body || '{}'));
    request.on('error', reject);
  });
}

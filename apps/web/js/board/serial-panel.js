import { escapeHtml } from './formatters.js';

export function createSerialPanel({ document, state, serialMonitor }) {
  const serialScrollContainer = serialMonitor;

  function bindSerialInput() {
    const input = document.querySelector('#serialInput');
    const baudRate = document.querySelector('#serialBaudRate');
    const button = document.querySelector('#sendSerialInput');
    const clearButton = document.querySelector('#clearSerialHistory');
    const autoScrollButton = document.querySelector('#toggleSerialAutoScroll');
    const send = () => {
      const value = input.value;

      if (!value) {
        return;
      }

      state.serialRxQueue.push({
        data: value,
        baudRate: Number(baudRate.value)
      });
      appendSerialEvents([{
        direction: 'RX',
        type: 'data',
        baudRate: Number(baudRate.value),
        data: value,
        timeUs: 0
      }]);
      input.value = '';
    };

    button.addEventListener('click', send);
    autoScrollButton.addEventListener('click', () => {
      state.serialAutoScroll = !state.serialAutoScroll;
      syncSerialAutoScrollButton(autoScrollButton);
      if (state.serialAutoScroll) {
        scrollSerialToBottom();
      }
    });
    syncSerialAutoScrollButton(autoScrollButton);
    clearButton.addEventListener('click', () => {
      clearSerialRx();
      clearSerialHistory();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        send();
      }
    });
  }

  function renderSerial() {
    const events = state.serialHistory;

    if (events.length === 0) {
      serialMonitor.innerHTML = '<p class="muted">Nenhuma mensagem serial.</p>';
      return;
    }

    serialMonitor.innerHTML = events.map((event) => `
      <div class="serial-row">
        <span class="serial-direction ${event.direction.toLowerCase()}">${event.direction}</span>
        <span class="serial-meta">${event.baudRate ?? 'no baud'}<br>${event.timeUs} us</span>
        <span class="serial-data">${escapeHtml(event.data)}</span>
      </div>
    `).join('');

    if (state.serialAutoScroll) {
      scrollSerialToBottom();
    }
  }

  function consumeSerialRx() {
    const messages = [...state.serialRxQueue];
    state.serialRxQueue = [];
    return messages;
  }

  function clearSerialRx() {
    state.serialRxQueue = [];
  }

  function appendSerialEvents(events) {
    const maxEvents = 1000;
    state.serialHistory.push(...events);

    if (state.serialHistory.length > maxEvents) {
      state.serialHistory.splice(0, state.serialHistory.length - maxEvents);
    }

    renderSerial();
  }

  function clearSerialHistory() {
    state.serialHistory = [];
    renderSerial();
  }

  function scrollSerialToBottom() {
    requestAnimationFrame(() => {
      serialScrollContainer.scrollTop = serialScrollContainer.scrollHeight;
    });
  }

  function syncSerialAutoScrollButton(button) {
    button.classList.toggle('active', state.serialAutoScroll);
    button.setAttribute('aria-pressed', String(state.serialAutoScroll));
    button.setAttribute('aria-label', `Auto-scroll Serial ${state.serialAutoScroll ? 'ativado' : 'desativado'}`);
    button.title = `Auto-scroll Serial ${state.serialAutoScroll ? 'ativado' : 'desativado'}`;
  }

  return {
    bindSerialInput,
    renderSerial,
    consumeSerialRx,
    clearSerialRx,
    appendSerialEvents,
    clearSerialHistory
  };
}

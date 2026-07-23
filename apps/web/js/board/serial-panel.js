import { t } from '../i18n.js';
import { escapeHtml } from './formatters.js';

export function createSerialPanel({ document, state, serialMonitor }) {
  const serialScrollContainer = serialMonitor;

  function bindSerialInput() {
    const input = document.querySelector('#serialInput');
    const target = document.querySelector('#serialTarget');
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
        targetComponentId: target.value || null,
        baudRate: Number(baudRate.value)
      });
      appendSerialEvents([{
        direction: 'RX',
        type: 'data',
        componentId: target.value || null,
        baudRate: Number(baudRate.value),
        data: value,
        timeUs: 0
      }]);
      input.value = '';
    };

    syncSerialTargets(target);
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
    syncSerialTargets(document.querySelector('#serialTarget'));
    const events = state.serialHistory;

    if (events.length === 0) {
      serialMonitor.innerHTML = `<p class="muted">${t('No serial messages.')}</p>`;
      return;
    }

    serialMonitor.innerHTML = events.map((event) => `
      <div class="serial-row">
        <span class="serial-direction ${event.direction.toLowerCase()}">${event.direction}</span>
        <span class="serial-meta">${escapeHtml(event.componentId ?? t('serial'))}<br>${event.baudRate ?? t('no baud')}<br>${event.timeUs} us</span>
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

    for (const event of events) {
      appendSerialEvent(event);
    }

    if (state.serialHistory.length > maxEvents) {
      state.serialHistory.splice(0, state.serialHistory.length - maxEvents);
    }

    renderSerial();
  }

  function appendSerialEvent(event) {
    const last = lastOpenSerialTxLine(event);

    if (canAppendToSerialTxLine(last, event)) {
      last.data += event.data;
      last.lineComplete = Boolean(event.lineComplete);
      return;
    }

    state.serialHistory.push({ ...event });
  }

  function lastOpenSerialTxLine(event) {
    if (event.direction !== 'TX' || event.type !== 'data') {
      return null;
    }

    return state.serialHistory.findLast((historyEvent) => {
      return canAppendToSerialTxLine(historyEvent, event);
    }) ?? null;
  }

  function canAppendToSerialTxLine(last, event) {
    return Boolean(
      last
        && last.direction === 'TX'
        && event.direction === 'TX'
        && last.type === 'data'
        && event.type === 'data'
        && last.lineComplete !== true
        && last.componentId === event.componentId
        && last.baudRate === event.baudRate
    );
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
    const label = state.serialAutoScroll ? t('Auto-scroll Serial enabled') : t('Auto-scroll Serial disabled');
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function syncSerialTargets(select) {
    if (!select) {
      return;
    }

    const selected = select.value;
    const targets = [...state.components.values()]
      .filter((component) => component.behavior?.type === 'microcontroller')
      .map((component) => ({
        id: component.id,
        label: `${component.id} (${component.type})`
      }));

    select.innerHTML = targets.length > 0
      ? targets.map((target) => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.label)}</option>`).join('')
      : `<option value="">${t('Target RX Serial')}</option>`;

    if (targets.some((target) => target.id === selected)) {
      select.value = selected;
    }
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

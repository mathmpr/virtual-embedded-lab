export function createBuzzerAudioController({ maxGain = 0.08 } = {}) {
  let enabled = false;
  let audioContext = null;
  const voices = new Map();

  async function enable() {
    enabled = true;
    audioContext = audioContext ?? new AudioContext();

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  }

  function disable() {
    enabled = false;
    stopAll();
  }

  function toggle() {
    return enabled ? (disable(), false) : enable().then(() => true);
  }

  function sync(components) {
    if (!enabled || !audioContext) {
      stopAll();
      return;
    }

    const activeIds = new Set();

    for (const component of components) {
      if (component.type !== 'buzzer') {
        continue;
      }

      const active = Boolean(component.properties.active);

      if (!active) {
        stop(component.id);
        continue;
      }

      activeIds.add(component.id);
      startOrUpdate(component);
    }

    for (const id of voices.keys()) {
      if (!activeIds.has(id)) {
        stop(id);
      }
    }
  }

  function startOrUpdate(component) {
    const frequency = clamp(Number(component.properties.frequencyHz ?? 2000), 20, 20000);
    const volume = clamp(Number(component.properties.volumePercent ?? 60) / 100, 0, 1) * maxGain;
    const existing = voices.get(component.id);

    if (existing) {
      existing.oscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.01);
      existing.gain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01);
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.015);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();

    voices.set(component.id, { oscillator, gain });
  }

  function stop(id) {
    const voice = voices.get(id);

    if (!voice || !audioContext) {
      return;
    }

    voice.gain.gain.cancelScheduledValues(audioContext.currentTime);
    voice.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
    voice.oscillator.stop(audioContext.currentTime + 0.04);
    voices.delete(id);
  }

  function stopAll() {
    for (const id of [...voices.keys()]) {
      stop(id);
    }
  }

  return {
    get enabled() {
      return enabled;
    },
    enable,
    disable,
    toggle,
    sync,
    stopAll
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

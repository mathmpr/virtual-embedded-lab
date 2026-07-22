import { propertyLabel } from '../i18n.js';

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatVoltage(value) {
  return value === null ? 'flutuante' : `${value.toFixed(2)} V`;
}

export function normalizeVoltage(value) {
  return Number.isFinite(value) ? clamp(value / 5, 0, 1) : 0;
}

export function normalizeCurrent(value) {
  return Number.isFinite(value) ? clamp(value / 0.04, 0, 1) : 1;
}

export function normalizePower(value) {
  return Number.isFinite(value) ? clamp(value / 0.25, 0, 1) : 1;
}

export function normalizeAnalog(value) {
  return clamp(Number(value) / 1023, 0, 1);
}

export function normalizePropertySignal(key, value) {
  if (key.toLowerCase().includes('percent')) {
    return clamp(value / 100, 0, 1);
  }

  if (key.toLowerCase().includes('ohms')) {
    return clamp(Math.log10(Math.max(1, value)) / 6, 0, 1);
  }

  return Number.isFinite(value) ? clamp(value / 1023, 0, 1) : 0;
}

export function formatPropertySignal(key, value) {
  if (key.toLowerCase().includes('percent')) {
    return `${value}%`;
  }

  if (key.toLowerCase().includes('ohms')) {
    return `${value} Ω`;
  }

  return String(value);
}

export function labelFromPropertyName(key) {
  return propertyLabel(key);
}

export function formatCurrent(value) {
  return Number.isFinite(value) ? `${(value * 1000).toFixed(2)} mA` : 'infinita';
}

export function formatPower(value) {
  return Number.isFinite(value) ? `${(value * 1000).toFixed(2)} mW` : 'infinita';
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

import { messages as enMessages, propertyMessages as enPropertyMessages } from './i18n/locales/en.js';
import { messages as esMessages, propertyMessages as esPropertyMessages } from './i18n/locales/es.js';
import { messages as ptBRMessages, propertyMessages as ptBRPropertyMessages } from './i18n/locales/pt-BR.js';

export const defaultLocale = 'pt-BR';
export const localeStorageKey = 'virtual-embedded-lab.locale';
export const supportedLocales = ['pt-BR', 'en', 'es'];

const localeMessages = {
  'pt-BR': ptBRMessages,
  en: enMessages,
  es: esMessages
};

const localePropertyMessages = {
  'pt-BR': ptBRPropertyMessages,
  en: enPropertyMessages,
  es: esPropertyMessages
};

let currentLocale = readStoredLocale();

export function t(key) {
  if (key === undefined || key === null) {
    return key;
  }

  const value = String(key);
  return localeMessages[currentLocale]?.[value] ?? value;
}

export function stateText(key) {
  return t(key);
}

export function propertyLabel(key) {
  return localePropertyMessages[currentLocale]?.[key] ?? labelFromCamelCase(key);
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale);

  if (nextLocale === currentLocale) {
    return currentLocale;
  }

  currentLocale = nextLocale;
  safeLocalStorage()?.setItem(localeStorageKey, currentLocale);
  globalThis.dispatchEvent?.(new CustomEvent('virtual-lab:locale-change', {
    detail: { locale: currentLocale }
  }));
  return currentLocale;
}

export function applyDocumentTranslations(root) {
  root.documentElement.lang = currentLocale;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  });
}

export function bindLanguageSelector(document, onLocaleChange = () => {}) {
  const selector = document.querySelector('#languageSelector');

  if (!selector) {
    return;
  }

  selector.value = currentLocale;
  selector.addEventListener('change', () => {
    setLocale(selector.value);
    applyDocumentTranslations(document);
    onLocaleChange(currentLocale);
  });
}

export function localizeComponentDefinition(definition) {
  return {
    ...definition,
    title: t(definition.title),
    body: t(definition.body),
    controls: localizeControls(definition.controls),
    propertySchema: localizePropertySchema(definition.propertySchema),
    variants: localizeVariants(definition.variants),
    palette: definition.palette ? localizePalette(definition.palette) : null,
    stateBindings: localizeStateBindings(definition.stateBindings),
    terminals: definition.terminals.map((terminal) => ({
      ...terminal,
      label: t(terminal.label)
    }))
  };
}

function localizeControls(controls = []) {
  return controls.map((control) => ({
    ...control,
    label: t(control.label),
    text: t(control.text),
    inactiveText: t(control.inactiveText),
    children: localizeControls(control.children ?? [])
  }));
}

function localizePropertySchema(schema = {}) {
  return Object.fromEntries(
    Object.entries(schema).map(([key, property]) => [
      key,
      {
        ...property,
        label: t(property.label ?? propertyLabel(key))
      }
    ])
  );
}

function localizeVariants(variants = {}) {
  return Object.fromEntries(
    Object.entries(variants).map(([key, values]) => [
      key,
      values.map((variant) => ({
        ...variant,
        label: t(variant.label)
      }))
    ])
  );
}

function localizePalette(palette) {
  const localized = { ...palette };

  if (palette.group !== undefined) {
    localized.group = t(palette.group);
  }

  if (palette.subgroup !== undefined) {
    localized.subgroup = t(palette.subgroup);
  }

  if (palette.title !== undefined) {
    localized.title = t(palette.title);
  }

  return localized;
}

function localizeStateBindings(bindings = []) {
  return bindings.map((binding) => ({
    ...binding,
    text: t(binding.text),
    disabledText: t(binding.disabledText)
  }));
}

function labelFromCamelCase(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

function readStoredLocale() {
  return normalizeLocale(safeLocalStorage()?.getItem(localeStorageKey));
}

function normalizeLocale(locale) {
  return supportedLocales.includes(locale) ? locale : defaultLocale;
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

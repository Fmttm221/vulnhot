import { en, zh, type MessageKey } from './i18n/messages.ts';
import { currentLocale, type Locale } from './locale.ts';

export { currentLocale } from './locale.ts';
export type { MessageKey } from './i18n/messages.ts';

/** Interpolate a complete UI sentence. Values are never translated as editorial content. */
export function t(key: MessageKey, values: readonly unknown[] = [], locale = currentLocale()): string {
  const message = locale === 'en' ? en[key] : zh[key];
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) => Number(index) < values.length ? String(values[Number(index)]) : placeholder);
}

// Only complete descriptive sentences need pattern matching (site config interpolates
// them before export). Short date/count templates must use t(), otherwise a generic
// pattern such as "{0}月{1}" could accidentally rewrite an unrelated label.
const patterns = Object.keys(zh).filter((key) => /\{\d+\}/.test(key) && (key.replace(/\{\d+\}/g, '').length >= 8 || /^(?:每天|每周一|每月 1 日) /.test(key))).map((key) => {
  const names: string[] = [];
  const parts = key.split(/(\{\d+\})/g).map((part) => {
    if (/^\{\d+\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]*?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { key: key as MessageKey, names, expression: new RegExp(`^${parts.join('')}$`) };
}).sort((a, b) => b.key.length - a.key.length);

/** Display labels supplied by site configuration/modules. Call only for UI copy, never article data. */
export function ui(value: string, locale?: Locale): string;
export function ui<T>(value: T, locale?: Locale): T;
export function ui(value: unknown, locale: Locale = currentLocale()): unknown {
  if (typeof value !== 'string') return value;
  if (locale !== 'en' || !/[\u3400-\u9fff]/.test(value)) return value;
  const key = value as MessageKey;
  if (Object.hasOwn(en, key)) return en[key];
  for (const pattern of patterns) {
    const match = pattern.expression.exec(value);
    if (!match) continue;
    const values: string[] = [];
    pattern.names.forEach((name, index) => { values[Number(name)] = ui(match[index + 1]!, locale); });
    return t(pattern.key, values, locale);
  }
  return value;
}

/** Localize display configuration without changing keys, URLs, identifiers or backend exports. */
export function uiCopy<T>(value: T): T {
  if (currentLocale() !== 'en') return value;
  if (typeof value === 'string') return ui(value) as T;
  if (Array.isArray(value)) return value.map((entry) => uiCopy(entry)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, uiCopy(entry)])) as T;
  return value;
}

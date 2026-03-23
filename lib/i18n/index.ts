import { defaultLocale, type Locale } from './types';
export { type Locale, defaultLocale } from './types';
import { commonEnUS, commonHiIN, commonEnIN } from './common';
import { stageEnUS, stageHiIN, stageEnIN } from './stage';
import { chatEnUS, chatHiIN, chatEnIN } from './chat';
import {
  generationEnUS,
  generationHiIN,
  generationEnIN,
} from './generation';
import {
  settingsEnUS,
  settingsHiIN,
  settingsEnIN,
} from './settings';

export const translations = {
  'en-US': {
    ...commonEnUS,
    ...stageEnUS,
    ...chatEnUS,
    ...generationEnUS,
    ...settingsEnUS,
  },
  'hi-IN': {
    ...commonHiIN,
    ...stageHiIN,
    ...chatHiIN,
    ...generationHiIN,
    ...settingsHiIN,
  },
  'en-IN': {
    ...commonEnIN,
    ...stageEnIN,
    ...chatEnIN,
    ...generationEnIN,
    ...settingsEnIN,
  },
} as const;

export type TranslationKey = keyof (typeof translations)[typeof defaultLocale];

export function translate(locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: unknown = translations[locale];
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k];
  }
  return (typeof value === 'string' ? value : undefined) ?? key;
}

export function getClientTranslation(key: string): string {
  let locale: Locale = defaultLocale;

  if (typeof window !== 'undefined') {
    try {
      const storedLocale = localStorage.getItem('locale') as Locale;
      if (storedLocale && translations[storedLocale]) {
        locale = storedLocale;
      }
    } catch {
      // localStorage unavailable, keep default locale
    }
  }

  return translate(locale, key);
}

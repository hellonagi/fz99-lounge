export const locales = ['en', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
};

export const localeFlags: Record<Locale, string> = {
  en: 'us',
  ja: 'jp',
};

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

// Deep merge function for nested translation objects
function deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
  const result = { ...target } as T;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  // Load both current locale and fallback (English) messages
  const userMessages = (await import(`../messages/${locale}.json`)).default;
  const defaultMessages = locale !== defaultLocale
    ? (await import(`../messages/${defaultLocale}.json`)).default
    : userMessages;

  return {
    locale,
    // Deep merge: fallback messages first, then override with locale-specific messages
    messages: deepMerge(defaultMessages, userMessages),
  };
});

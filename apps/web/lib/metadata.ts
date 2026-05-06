const BASE_URL = 'https://fz99lounge.com';

export function getAlternates(locale: string, path: string = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = normalizedPath === '/' ? '' : normalizedPath;
  const enUrl = `${BASE_URL}/en${fullPath}`;

  return {
    canonical: `${BASE_URL}/${locale}${fullPath}`,
    languages: {
      en: enUrl,
      ja: `${BASE_URL}/ja${fullPath}`,
      'x-default': enUrl,
    },
  };
}

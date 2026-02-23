const BASE_URL = 'https://fz99lounge.com';

export function getAlternates(locale: string, path: string = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = normalizedPath === '/' ? '' : normalizedPath;

  return {
    canonical: `${BASE_URL}/${locale}${fullPath}`,
    languages: {
      en: `${BASE_URL}/en${fullPath}`,
      ja: `${BASE_URL}/ja${fullPath}`,
    },
  };
}

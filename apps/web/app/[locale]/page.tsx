import { getNewsList } from '@/lib/news';
import { HomePage } from './home-page';

const SITE_URL = 'https://fz99lounge.com';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const latestNews = getNewsList(locale, 3);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'FZ99 Lounge',
      url: SITE_URL,
      logo: `${SITE_URL}/fz99lounge.jpg`,
      sameAs: ['https://discord.com/invite/whCEtSnw'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'FZ99 Lounge',
      url: SITE_URL,
      inLanguage: locale === 'ja' ? 'ja-JP' : 'en-US',
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage latestNews={latestNews} />
    </>
  );
}

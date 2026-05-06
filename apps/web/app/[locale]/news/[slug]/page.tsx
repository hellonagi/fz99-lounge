import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAlternates } from '@/lib/metadata';
import { getNewsArticle, getNewsSlugs } from '@/lib/news';
import { NewsArticle } from '@/components/features/news';

const SITE_URL = 'https://fz99lounge.com';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  const slugs = getNewsSlugs();
  return slugs.flatMap((slug) => [
    { locale: 'en', slug },
    { locale: 'ja', slug },
  ]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getNewsArticle(slug, locale);
  if (!article) return {};
  const ogLocale = locale === 'ja' ? 'ja_JP' : 'en_US';
  const alternateLocale = locale === 'ja' ? 'en_US' : 'ja_JP';
  const images = article.cover ? [article.cover] : undefined;
  return {
    title: article.title,
    description: article.summary,
    authors: [{ name: article.author }],
    alternates: getAlternates(locale, `/news/${slug}`),
    openGraph: {
      title: article.title,
      description: article.summary,
      url: `${SITE_URL}/${locale}/news/${slug}`,
      siteName: 'FZ99 Lounge',
      type: 'article',
      locale: ogLocale,
      alternateLocale: [alternateLocale],
      publishedTime: article.date,
      modifiedTime: article.date,
      authors: [article.author],
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary,
      ...(images ? { images } : {}),
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  const article = getNewsArticle(slug, locale);
  if (!article) notFound();

  const articleUrl = `${SITE_URL}/${locale}/news/${slug}`;
  const imageUrl = article.cover ? `${SITE_URL}${article.cover}` : undefined;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    datePublished: article.date,
    dateModified: article.date,
    author: [{ '@type': 'Person', name: article.author }],
    publisher: {
      '@type': 'Organization',
      name: 'FZ99 Lounge',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/fz99lounge.jpg`,
      },
    },
    ...(imageUrl ? { image: [imageUrl] } : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    inLanguage: locale === 'ja' ? 'ja-JP' : 'en-US',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NewsArticle article={article} locale={locale} />
    </>
  );
}

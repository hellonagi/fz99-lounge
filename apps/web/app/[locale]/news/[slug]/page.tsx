import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAlternates } from '@/lib/metadata';
import { getNewsArticle, getNewsSlugs } from '@/lib/news';
import { NewsArticle } from '@/components/features/news';

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
  return {
    title: article.title,
    description: article.summary,
    alternates: getAlternates(locale, `/news/${slug}`),
    openGraph: {
      title: article.title,
      description: article.summary,
      type: 'article',
      ...(article.cover ? { images: [article.cover] } : {}),
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  const article = getNewsArticle(slug, locale);
  if (!article) notFound();
  return <NewsArticle article={article} locale={locale} />;
}

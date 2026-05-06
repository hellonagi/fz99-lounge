import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAlternates } from '@/lib/metadata';
import { getNewsList } from '@/lib/news';
import { NewsListSection } from '@/components/features/news';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('news'),
    alternates: getAlternates(locale, '/news'),
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const articles = getNewsList(locale);
  return <NewsListSection articles={articles} locale={locale} />;
}

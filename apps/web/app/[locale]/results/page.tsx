import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAlternates } from '@/lib/metadata';
import ResultsPage from './results-page';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'results' });

  return {
    title: t('title'),
    alternates: getAlternates(locale, '/results'),
  };
}

export default function Page() {
  return (
    <Suspense>
      <ResultsPage />
    </Suspense>
  );
}

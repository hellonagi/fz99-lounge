import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAlternates } from '@/lib/metadata';
import RulesPage from './rules-page';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rules' });

  return {
    title: t('title'),
    alternates: getAlternates(locale, '/rules'),
  };
}

export default function Page() {
  return <RulesPage />;
}

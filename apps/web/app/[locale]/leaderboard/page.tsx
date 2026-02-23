import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAlternates } from '@/lib/metadata';
import LeaderboardPage from './leaderboard-page';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'leaderboard' });

  return {
    title: t('title'),
    alternates: getAlternates(locale, '/leaderboard'),
  };
}

export default function Page() {
  return <LeaderboardPage />;
}

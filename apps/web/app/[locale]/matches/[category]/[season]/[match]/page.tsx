import type { Metadata } from 'next';
import { getAlternates } from '@/lib/metadata';
import GamePage from './match-page';

type Props = {
  params: Promise<{ locale: string; category: string; season: string; match: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category, season, match } = await params;

  return {
    alternates: getAlternates(locale, `/matches/${category}/${season}/${match}`),
  };
}

export default function Page() {
  return <GamePage />;
}

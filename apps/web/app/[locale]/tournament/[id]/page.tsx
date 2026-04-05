import type { Metadata } from 'next';
import { getAlternates } from '@/lib/metadata';
import TournamentPage from './tournament-page';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;

  return {
    alternates: getAlternates(locale, `/tournament/${id}`),
  };
}

export default function Page() {
  return <TournamentPage />;
}

import type { Metadata } from 'next';
import { getAlternates } from '@/lib/metadata';
import TournamentShell from './tournament-shell';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  return {
    alternates: getAlternates(locale, `/tournament/${id}`),
  };
}

export default function Layout({ children }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <TournamentShell>{children}</TournamentShell>
    </div>
  );
}

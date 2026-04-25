'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { tournamentsApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tournament, TournamentStatus } from '@/types';
import { TournamentProvider } from './tournament-context';

function getStatusBadgeVariant(status: TournamentStatus): 'default' | 'success' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'REGISTRATION_OPEN':
      return 'success';
    case 'IN_PROGRESS':
      return 'destructive';
    case 'COMPLETED':
      return 'secondary';
    default:
      return 'default';
  }
}

export default function TournamentShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = Number(params.id);
  const t = useTranslations('tournament');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const res = await tournamentsApi.getById(id);
      setTournament(res.data);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTournament();
  }, [id]);

  if (loading) {
    return <div className="text-gray-400">{t('loading')}</div>;
  }

  if (error || !tournament) {
    return <div className="text-red-400">{error || t('notFound')}</div>;
  }

  const basePath = `/${params.locale}/tournament/${id}`;

  const activeTab = pathname.startsWith(`${basePath}/rounds`)
    ? 'rounds'
    : pathname.startsWith(`${basePath}/standings`)
      ? 'standings'
      : 'overview';

  const tabs = [
    { key: 'overview', href: basePath, label: t('tabs.overview') },
    { key: 'rounds', href: `${basePath}/rounds`, label: t('tabs.rounds') },
    { key: 'standings', href: `${basePath}/standings`, label: t('tabs.standings') },
  ];

  return (
    <TournamentProvider tournament={tournament} onUpdate={fetchTournament}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            {tournament.name}{' '}
            <span className="text-gray-400">
              {t('number', { number: tournament.tournamentNumber })}
            </span>
          </h1>
          <Badge variant={getStatusBadgeVariant(tournament.status)}>
            {t(`statusLabel.${tournament.status}`)}
          </Badge>
        </div>

        {/* Tab Navigation */}
        <nav className="inline-flex items-center border-b border-gray-700 w-full">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap px-3 sm:px-6 py-2 sm:py-3 text-sm font-medium transition-colors',
                'text-gray-400 hover:text-white hover:bg-gray-700/50',
                activeTab === tab.key && 'bg-gray-700 text-white border-b-2 border-blue-500',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Page Content */}
        <div>{children}</div>
      </div>
    </TournamentProvider>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { tournamentsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Tournament } from '@/types';
import { TournamentProvider } from './tournament-context';

export default function TournamentShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = Number(params.id);
  const t = useTranslations('tournament');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await tournamentsApi.getById(id);
      setTournament(res.data);
    } catch {
      if (!tournament) setError(t('error'));
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchTournament().finally(() => setLoading(false));
    }
  }, [id, fetchTournament]);

  if (loading) {
    return <div className="text-gray-400">{t('loading')}</div>;
  }

  if (error || !tournament) {
    return <div className="text-red-400">{error || t('notFound')}</div>;
  }

  const basePath = `/${params.locale}/tournament/${id}`;

  const activeTab = pathname.startsWith(`${basePath}/stats`)
    ? 'stats'
    : pathname.startsWith(`${basePath}/match`)
      ? 'match'
      : 'overview';

  const showMatch = tournament.status !== 'DRAFT';
  const showStats = tournament.status === 'COMPLETED';

  const tabs = [
    { key: 'overview', href: basePath, label: t('tabs.overview') },
    ...(showMatch
      ? [{ key: 'match', href: `${basePath}/match`, label: t('tabs.match') }]
      : []),
    ...(showStats
      ? [{ key: 'stats', href: `${basePath}/stats`, label: t('tabs.stats') }]
      : []),
  ];

  return (
    <TournamentProvider tournament={tournament} onUpdate={fetchTournament}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {tournament.name}{' '}
            <span className="text-gray-400">
              {t('number', { number: tournament.tournamentNumber })}
            </span>
          </h1>
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

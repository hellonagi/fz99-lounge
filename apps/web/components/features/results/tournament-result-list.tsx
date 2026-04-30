'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { CategoryBadge } from '@/components/ui/category-badge';
import { RecentTournament } from '@/types';

interface TournamentResultListProps {
  tournaments: RecentTournament[];
  loading?: boolean;
}

export function TournamentResultList({
  tournaments,
  loading,
}: TournamentResultListProps) {
  const t = useTranslations('results');
  const locale = useLocale();

  if (loading) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">
        {t('noTournaments')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tournaments.map((tournament) => (
        <Link
          key={tournament.id}
          href={`/${locale}/tournament/${tournament.id}/match`}
          className="block"
        >
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-700/50 border border-gray-600 hover:bg-gray-700/80 transition-colors">
            {/* Left: Tournament Info */}
            <div className="flex items-center gap-3 shrink-0">
              <CategoryBadge category="TOURNAMENT" />
              <span className="text-gray-300 text-sm whitespace-nowrap">
                {tournament.name} #{tournament.tournamentNumber}
              </span>
              <span className="hidden sm:inline text-gray-500 text-xs whitespace-nowrap">
                {new Intl.DateTimeFormat(
                  locale === 'ja' ? 'ja-JP' : 'en-US',
                  { year: 'numeric', month: '2-digit', day: '2-digit' }
                ).format(new Date(tournament.tournamentDate))}
              </span>
            </div>

            {/* Right: Winner */}
            <div className="flex items-center gap-2">
              {tournament.winner && (
                <>
                  <span className="text-gray-200 text-sm font-bold truncate max-w-[160px] sm:max-w-none">
                    🏆️{tournament.winner.displayName || `User#${tournament.winner.id}`}
                  </span>
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {tournament.winner.totalScore}pts
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

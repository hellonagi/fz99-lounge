'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_LABEL,
} from '@/components/features/match/match-constants';
import {
  buildDivisionWinners,
  DivisionWinnerLine,
} from '@/components/features/tournament/division-winners';
import { RecentTournament } from '@/types';

interface TournamentResultListProps {
  tournaments: RecentTournament[];
  loading?: boolean;
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
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

  const badgeClass =
    CATEGORY_BADGE_CLASS.TOURNAMENT || 'text-amber-400 border-amber-500/50';
  const categoryLabel = CATEGORY_LABEL.TOURNAMENT || 'Tournament';

  return (
    <div className="border border-white/[.07] bg-white/[.05] sm:rounded-lg overflow-hidden">
      {tournaments.map((tournament) => {
        const url = `/${locale}/tournament/${tournament.id}/match`;
        const dateLabel = formatDate(tournament.tournamentDate, locale);
        const titleLabel = `${tournament.name} #${tournament.tournamentNumber}`;
        const divisionWinners = buildDivisionWinners(tournament);

        return (
          <Link
            key={tournament.id}
            href={url}
            className="block border-b border-white/[.07] last:border-b-0 hover:bg-white/[.03] transition-colors"
          >
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto] gap-x-2 items-center py-3.5 px-5">
              <div className="font-mono tabular-nums text-sm text-gray-400">
                {dateLabel}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20 whitespace-nowrap',
                    badgeClass,
                  )}
                >
                  {categoryLabel}
                </span>
                <span className="text-sm font-bold text-gray-300 truncate">
                  {titleLabel}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1 min-w-0">
                {divisionWinners.map((entry) => (
                  <DivisionWinnerLine
                    key={entry.key}
                    entry={entry}
                    className="justify-end max-w-[400px]"
                  />
                ))}
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20 whitespace-nowrap',
                    badgeClass,
                  )}
                >
                  {categoryLabel}
                </span>
                <span className="text-sm font-bold text-gray-300 truncate">
                  {titleLabel}
                </span>
                <span className="font-mono tabular-nums text-xs text-gray-400 ml-auto shrink-0">
                  {dateLabel}
                </span>
              </div>
              {divisionWinners.map((entry) => (
                <DivisionWinnerLine
                  key={entry.key}
                  entry={entry}
                  scoreClassName="ml-auto"
                />
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

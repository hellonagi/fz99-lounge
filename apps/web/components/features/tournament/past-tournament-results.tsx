'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_BADGE_CLASS, CATEGORY_LABEL } from '@/components/features/match/match-constants';
import { RecentTournament } from '@/types';

interface PastTournamentResultsProps {
  tournaments: RecentTournament[];
  loading?: boolean;
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function PastTournamentResults({
  tournaments,
  loading,
}: PastTournamentResultsProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  if (!loading && (!tournaments || tournaments.length === 0)) {
    return null;
  }

  return (
    <section className="pt-4 pb-16">
      <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-6 text-center px-4 sm:px-0">
          {t('pastTournaments')}
        </h2>

        {loading ? (
          <div className="text-gray-400 text-sm text-center py-8">
            {tCommon('loading')}
          </div>
        ) : (
          <div className="border border-white/[.07] bg-white/[.05] sm:rounded-lg overflow-hidden">
            {tournaments.map((tournament) => {
              const badgeClass =
                CATEGORY_BADGE_CLASS.TOURNAMENT ||
                'text-amber-400 border-amber-500/50';
              const categoryLabel = CATEGORY_LABEL.TOURNAMENT || 'Tournament';
              const url = `/${locale}/tournament/${tournament.id}/match`;
              const dateLabel = formatDate(tournament.tournamentDate, locale);
              const titleLabel = `${tournament.name} #${tournament.tournamentNumber}`;

              const winnerList =
                tournament.winners && tournament.winners.length > 0
                  ? tournament.winners
                  : tournament.winner
                    ? [tournament.winner]
                    : [];
              const winnerNames = winnerList
                .map((w) => w.displayName || `User#${w.id}`)
                .join(' ');
              const sharedScore = winnerList[0]?.totalScore ?? null;

              return (
                <Link
                  key={tournament.id}
                  href={url}
                  className="block border-b border-white/[.07] last:border-b-0 hover:bg-white/[.03] transition-colors"
                >
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[auto_1fr_auto] gap-x-2 items-center py-3.5 px-5">
                    <div className="font-mono tabular-nums text-xs text-gray-500">
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
                      <span className="text-xs font-bold text-gray-300 truncate">
                        {titleLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end min-w-0">
                      {winnerList.length > 0 && (
                        <>
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-sm font-bold text-gray-200 truncate max-w-[320px]">
                            {winnerNames}
                          </span>
                          {sharedScore !== null && (
                            <span className="flex items-baseline gap-0.5 shrink-0">
                              <span className="font-mono tabular-nums text-xs text-gray-500">
                                {sharedScore}
                              </span>
                              <span className="text-[10px] font-bold tracking-[.1em] uppercase text-gray-600">
                                pts
                              </span>
                            </span>
                          )}
                        </>
                      )}
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
                      <span className="text-xs font-bold text-gray-300 truncate">
                        {titleLabel}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-gray-500 ml-auto shrink-0">
                        {dateLabel}
                      </span>
                    </div>
                    {winnerList.length > 0 && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-sm font-bold text-gray-200 truncate">
                          {winnerNames}
                        </span>
                        {sharedScore !== null && (
                          <span className="flex items-baseline gap-0.5 ml-auto shrink-0">
                            <span className="font-mono tabular-nums text-xs text-gray-500">
                              {sharedScore}
                            </span>
                            <span className="text-[10px] font-bold tracking-[.1em] uppercase text-gray-600">
                              pts
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

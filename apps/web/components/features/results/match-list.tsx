'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_LABEL,
} from '@/components/features/match/match-constants';

interface MatchWinner {
  id: number;
  displayName: string | null;
  totalScore: number | null;
}

interface MatchResult {
  id: number;
  matchNumber: number;
  category: string;
  seasonNumber: number;
  playerCount: number;
  status: string;
  startedAt: string | null;
  isRated?: boolean;
  winner: MatchWinner | null;
  winners?: MatchWinner[];
}

interface MatchListProps {
  matches: MatchResult[];
  loading?: boolean;
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function MatchList({ matches, loading }: MatchListProps) {
  const locale = useLocale();
  const tCommon = useTranslations('common');

  if (loading) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
    );
  }

  const filteredMatches =
    matches?.filter((match) => match.winner && match.playerCount > 1) ?? [];

  if (filteredMatches.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">
        No matches found
      </div>
    );
  }

  return (
    <div className="border border-white/[.07] bg-white/[.05] sm:rounded-lg overflow-hidden">
      {filteredMatches.map((match) => {
        const upper = match.category.toUpperCase();
        const badgeClass =
          CATEGORY_BADGE_CLASS[upper] || 'text-gray-400 border-gray-500/50';
        const categoryLabel = CATEGORY_LABEL[upper] || upper;
        const url = `/${locale}/matches/${match.category.toLowerCase()}/${match.seasonNumber === -1 ? 'unrated' : match.seasonNumber}/${match.matchNumber}`;
        const seasonLabel =
          match.seasonNumber === -1
            ? tCommon('unrated')
            : `Season ${match.seasonNumber} #${match.matchNumber}`;
        const dateLabel = match.startedAt
          ? formatDate(match.startedAt, locale)
          : '';

        const winnerList =
          match.winners && match.winners.length > 0
            ? match.winners
            : match.winner
              ? [match.winner]
              : [];
        const winnerNames = winnerList
          .map((w) => w.displayName || `User#${w.id}`)
          .join(' ');
        const sharedScore = winnerList[0]?.totalScore ?? null;

        return (
          <Link
            key={match.id}
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
                <span className="font-mono tabular-nums text-sm text-gray-400 whitespace-nowrap">
                  {seasonLabel}
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
                      <span className="shrink-0">
                        <span className="font-mono tabular-nums text-sm text-gray-400">
                          {sharedScore}
                        </span>
                        <span className="text-[10px] font-bold tracking-[.1em] uppercase text-gray-500 ml-0.5">
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
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-[10px] font-extrabold tracking-[.1em] px-1.5 py-0.5 border rounded-[3px] bg-black/20 whitespace-nowrap',
                    badgeClass,
                  )}
                >
                  {categoryLabel}
                </span>
                <span className="font-mono tabular-nums text-sm text-gray-400 whitespace-nowrap">
                  {seasonLabel}
                </span>
                <span className="font-mono tabular-nums text-xs text-gray-400 ml-auto">
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
                    <span className="ml-auto shrink-0">
                      <span className="font-mono tabular-nums text-sm text-gray-400">
                        {sharedScore}
                      </span>
                      <span className="text-[10px] font-bold tracking-[.1em] uppercase text-gray-500 ml-0.5">
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
  );
}

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface RecentMatch {
  id: number;
  matchNumber: number;
  category: string;
  seasonNumber: number;
  playerCount: number;
  status: string;
  startedAt: string | null;
  winner: {
    id: number;
    displayName: string | null;
    totalScore: number | null;
  } | null;
}

interface RecentMatchesProps {
  matches: RecentMatch[];
  loading?: boolean;
}

export function RecentMatches({ matches, loading }: RecentMatchesProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');

  if (loading) {
    return (
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t('recentMatches')}</h2>
        <div className="text-gray-400 text-sm">{tCommon('loading')}</div>
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t('recentMatches')}</h2>
        <div className="text-gray-400 text-sm">{t('noRecentMatches')}</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">{t('recentMatches')}</h2>
      <div className="border border-gray-700 rounded-lg p-4 mx-0 md:mx-6 space-y-2">
        {matches.map((match) => (
          <Link
            key={match.id}
            href={`/matches/${match.category.toLowerCase()}/${match.seasonNumber}/${match.matchNumber}`}
            className="block"
          >
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-600/50 hover:bg-gray-600 transition-colors">
              {/* Left: Category & Match Info */}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded',
                    match.category === 'CLASSIC'
                      ? 'bg-purple-600 text-white'
                      : 'bg-blue-600 text-white'
                  )}
                >
                  {match.category}
                </span>
                <span className="text-gray-300 text-sm">
                  S{match.seasonNumber} #{match.matchNumber}
                </span>
                <span className="hidden sm:inline text-gray-500 text-sm">
                  {t('players', { count: match.playerCount })}
                </span>
              </div>

              {/* Right: Winner */}
              <div className="flex items-center gap-2">
                {match.winner ? (
                  <>
                    <span className="text-white text-sm font-medium text-left truncate">
                      🏆{match.winner.displayName || `User#${match.winner.id}`}
                    </span>
                    {match.winner.totalScore !== null && (
                      <span className="text-gray-400 text-xs">
                        {match.winner.totalScore}pts
                      </span>
                    )}
                  </>
                ) : (
                  <span className="w-32 sm:w-40 text-gray-500 text-sm text-left">{t('inProgress')}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface RecentMatch {
  id: number;
  matchNumber: number | null;
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
  winningTeam: {
    score: number;
    members: { id: number; displayName: string | null }[];
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

  // Filter out cancelled matches (matchNumber is null)
  const validMatches = matches.filter((m) => m.matchNumber !== null);

  if (validMatches.length === 0) {
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
        {validMatches.map((match) => (
          <Link
            key={match.id}
            href={`/matches/${match.category.toLowerCase()}/${match.seasonNumber}/${match.matchNumber}`}
            className="block"
          >
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-600/50 hover:bg-gray-600 transition-colors">
              {/* Left: Category & Match Info */}
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded',
                    match.category === 'CLASSIC'
                      ? 'bg-purple-600 text-white'
                      : match.category === 'TEAM_CLASSIC'
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white'
                  )}
                >
                  {match.category === 'TEAM_CLASSIC' ? 'TEAM' : match.category}
                </span>
                <span className="text-gray-300 text-sm whitespace-nowrap">
                  S{match.seasonNumber} #{match.matchNumber}
                </span>
                <span className="hidden sm:inline text-gray-500 text-sm whitespace-nowrap">
                  {t('players', { count: match.playerCount })}
                </span>
              </div>

              {/* Right: Winner */}
              <div className="flex items-center gap-2">
                {match.winningTeam ? (
                  <>
                    <span className="text-white text-sm font-medium text-right truncate max-w-[200px] sm:max-w-none">
                      🏆{match.winningTeam.members
                        .map((m) => m.displayName || `User#${m.id}`)
                        .join(', ')}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {match.winningTeam.score}pts
                    </span>
                  </>
                ) : match.winner ? (
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

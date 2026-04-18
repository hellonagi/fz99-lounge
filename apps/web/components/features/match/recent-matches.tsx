'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { CategoryBadge } from '@/components/ui/category-badge';

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
}

interface RecentMatchesProps {
  matches: RecentMatch[];
  loading?: boolean;
}

export function RecentMatches({ matches, loading }: RecentMatchesProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  if (loading) {
    return (
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">{t('recentMatches')}</h2>
        <div className="text-gray-400 text-sm text-center">{tCommon('loading')}</div>
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">{t('recentMatches')}</h2>
        <div className="text-gray-400 text-sm text-center">{t('noRecentMatches')}</div>
      </div>
    );
  }

  // Filter out cancelled matches (matchNumber is null)
  const validMatches = matches.filter((m) => m.matchNumber !== null);

  if (validMatches.length === 0) {
    return (
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">{t('recentMatches')}</h2>
        <div className="text-gray-400 text-sm text-center">{t('noRecentMatches')}</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">{t('recentMatches')}</h2>
      <div className="space-y-2 mx-0">
        {validMatches.map((match) => (
          <Link
            key={match.id}
            href={`/${locale}/matches/${match.category.toLowerCase()}/${match.seasonNumber}/${match.matchNumber}`}
            className="block"
          >
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-700/50 border border-gray-600 hover:bg-gray-700/80 transition-colors">
              {/* Left: Category & Match Info */}
              <div className="flex items-center gap-3 shrink-0">
                <CategoryBadge category={match.category} />
                <span className="text-gray-300 text-sm whitespace-nowrap">
                  S{match.seasonNumber} #{match.matchNumber}
                </span>
                {match.startedAt && (
                  <span className="hidden sm:inline text-gray-500 text-xs whitespace-nowrap">
                    {new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(match.startedAt))}
                  </span>
                )}
              </div>

              {/* Right: Winner */}
              <div className="flex items-center gap-2">
                {match.winner && (
                  <>
                    <span className="text-gray-200 text-sm font-bold truncate max-w-[160px] sm:max-w-none">
                      🏆️{match.winner.displayName || `User#${match.winner.id}`}
                    </span>
                    {match.winner.totalScore !== null && (
                      <span className="text-gray-500 text-xs whitespace-nowrap">
                        {match.winner.totalScore}pts
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

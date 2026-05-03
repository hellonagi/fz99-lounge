'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SiDiscord } from 'react-icons/si';
import { Button, buttonVariants } from '@/components/ui/button';
import { MatchTimer } from './match-timer';
import { TrackScene } from '@/components/features/home/track-scene';
import { ThresholdBar } from './threshold-bar';
import { ParticipantAvatars } from './participant-avatars';
import {
  RATED_THRESHOLDS,
  START_THRESHOLDS,
  CATEGORY_COLOR,
  getMatchStatus,
} from './match-constants';

interface MatchHeroProps {
  category?: string;
  season?: number;
  match?: number;
  league?: string;
  currentPlayers?: number;
  minPlayers?: number;
  maxPlayers?: number;
  scheduledStart?: string;
  timeOffset?: number;
  onJoinClick?: () => void;
  isJoined?: boolean;
  isJoining?: boolean;
  errorMessage?: string;
  matchUrl?: string | null;
  isParticipant?: boolean;
  isAuthenticated?: boolean;
  participants?: Array<{
    userId: number;
    user: {
      id: number;
      discordId: string;
      displayName: string;
      avatarHash: string | null;
    };
  }>;
}

export function MatchHero({
  category,
  season,
  match,
  league,
  currentPlayers,
  minPlayers,
  maxPlayers,
  scheduledStart,
  timeOffset = 0,
  onJoinClick,
  isJoined = false,
  isJoining = false,
  errorMessage,
  matchUrl,
  isParticipant = false,
  isAuthenticated = true,
  participants,
}: MatchHeroProps) {
  const t = useTranslations('matchHero');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  const categoryKey = category?.toUpperCase() ?? '';
  const current = currentPlayers ?? 0;
  const max = maxPlayers ?? 12;
  const rated = RATED_THRESHOLDS[categoryKey] ?? minPlayers ?? max;
  const startThreshold = START_THRESHOLDS[categoryKey] ?? minPlayers ?? 4;
  const status = getMatchStatus(current, startThreshold, rated, max);
  const catColor = CATEGORY_COLOR[categoryKey] ?? { color: '#6b7280', soft: 'rgba(107,114,128,.12)' };

  const statusLabel =
    status === 'rated' || status === 'full'
      ? 'RATED'
      : status === 'matchOn'
        ? 'MATCH ON'
        : 'PENDING';
  const statusColor =
    status === 'rated' || status === 'full'
      ? 'text-emerald-400'
      : status === 'matchOn'
        ? 'text-amber-400'
        : 'text-gray-500';

  const heroTitle = (() => {
    const cat = category?.toLowerCase();
    if (cat === 'classic') return 'CLASSIC MINI';
    if (cat === 'team_classic') return 'TEAM CLASSIC';
    if (cat === 'team_gp') return league ? `TEAM ${league} GRAND PRIX` : 'TEAM GRAND PRIX';
    if (cat === 'gp') return league ? `${league} GRAND PRIX` : 'GRAND PRIX';
    return league ? `${league} LEAGUE` : 'NEXT MATCH';
  })();

  const seasonLabel = season !== undefined && season !== -1
    ? `SEASON${season} #${match}`
    : season === -1
      ? `UNRATED #${match}`
      : undefined;

  return (
    <section className="relative overflow-hidden">
      <TrackScene accentColor={catColor.color} />

      {/* Category gradient overlay */}
      <div
        className="absolute inset-0 z-[5]"
        style={{
          background: `radial-gradient(800px 300px at 50% 0%, ${catColor.soft}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="text-center">
          {errorMessage ? (
            <div className="py-12">
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                {errorMessage}
              </h1>
              <p className="text-gray-400">
                {t('checkNextMatch')}
              </p>
            </div>
          ) : (
            <>
              {/* Title */}
              {seasonLabel && (
                <div className="mb-1">
                  <span className="text-sm font-semibold text-gray-300 uppercase tracking-widest">
                    {seasonLabel}
                  </span>
                </div>
              )}

              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-1">
                {heroTitle}
              </h1>

              {matchUrl ? (
                <>
                  <div className="mt-3 mb-5">
                    <span className="text-sm font-bold tracking-[.12em] text-red-400">
                      ● {t('matchInProgress')}
                    </span>
                  </div>
                  {isParticipant && (
                    <p className="text-sm text-gray-200 mb-4">{t('goToMatchPage')}</p>
                  )}
                  <Link
                    href={matchUrl}
                    className="inline-block w-[160px] py-2.5 rounded-[5px] text-xs font-extrabold tracking-[.12em] text-center bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    {t('goToMatchButton')}
                  </Link>
                </>
              ) : (
                <>
                  {/* Timer */}
                  <div className="mt-3 mb-4 text-sm text-gray-300 tracking-wider">{t('startsIn')}</div>
                  {scheduledStart && (
                    <div className="[&>div]:mb-4">
                      <MatchTimer scheduledStart={scheduledStart} timeOffset={timeOffset} />
                    </div>
                  )}

                  {/* ThresholdBar */}
                  {currentPlayers !== undefined && maxPlayers !== undefined && (
                    <div className="max-w-lg mx-auto">
                      <ThresholdBar
                        current={current}
                        startThreshold={startThreshold}
                        rated={rated}
                        max={max}
                        status={status}
                        variant="hero"
                      />
                    </div>
                  )}

                  {/* Bottom: avatars + CTA */}
                  <div className="max-w-lg mx-auto mt-3 pt-3 border-t border-white/[.07]">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      {(() => {
                        const realCount = participants?.length ?? 0;
                        const minReached = minPlayers !== undefined && realCount >= minPlayers;
                        if (current === 0) return <div />;
                        return (
                          <ParticipantAvatars
                            participants={participants ?? []}
                            max={12}
                            anonymous={!minReached}
                            count={current}
                          />
                        );
                      })()}

                      {!isAuthenticated ? (
                        <a
                          href={`${baseUrl}/api/auth/discord`}
                          className={cn(
                            buttonVariants({ size: 'default', variant: 'discord' }),
                            'rounded-full md:px-6 md:py-3 md:text-base whitespace-nowrap',
                          )}
                        >
                          <SiDiscord className="w-4 h-4 mr-1.5 md:w-5 md:h-5 md:mr-2" />
                          {t('loginToJoin')}
                        </a>
                      ) : onJoinClick ? (
                        <button
                          onClick={onJoinClick}
                          disabled={isJoining}
                          className={cn(
                            'group/cta w-[120px] py-2.5 rounded-[5px] text-xs font-extrabold tracking-[.12em] whitespace-nowrap transition-colors cursor-pointer text-center',
                            isJoining && 'opacity-50 animate-pulse pointer-events-none',
                            isJoined
                              ? 'bg-blue-500/30 border border-blue-500/50 text-blue-300 hover:bg-red-500/25 hover:border-red-500/50 hover:text-red-300'
                              : 'bg-emerald-500/[.25] border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/35',
                          )}
                        >
                          {isJoining ? t('joining') : isJoined ? (
                            <>
                              <span className="group-hover/cta:hidden">{t('joined')}</span>
                              <span className="hidden group-hover/cta:inline">{t('leave')}</span>
                            </>
                          ) : t('join')}
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm mt-4 mb-1 text-center text-gray-400">
                      {t('passcodeNotice')}
                    </p>
                  </div>
                </>
              )}

              {/* Rules link - hide during match */}
              {!matchUrl && (
                <div className="mt-1">
                  <p className="text-sm text-gray-400">
                    {t.rich('reviewRules', {
                      matchRules: (chunks) => (
                        <Link href="/rules" className="text-blue-400 underline">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MatchTimer } from './match-timer';
import { PlayerCount } from './player-count';
import { TrackScene } from '@/components/features/home/track-scene';

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
}: MatchHeroProps) {
  const t = useTranslations('matchHero');

  return (
    <section className="relative min-h-[350px] md:min-h-[500px] overflow-hidden">
      {/* Hero background */}
      <TrackScene />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
        <div className="text-center">
          {errorMessage ? (
            // Error state
            <div className="py-16">
              <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                {errorMessage}
              </h1>
              <p className="text-gray-400">
                {t('checkNextMatch')}
              </p>
            </div>
          ) : (
            // Normal state
            <>
              {/* Season & Match info */}
              {category?.toLowerCase() === 'classic' ? (
                <>
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      SEASON{season} #{match}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-white mb-3">CLASSIC MINI</h1>
                </>
              ) : category?.toLowerCase() === 'team_classic' ? (
                <>
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      SEASON{season} #{match}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-white mb-3">TEAM CLASSIC</h1>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      Season {season} #{match}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-white mb-3">{league} LEAGUE</h1>
                </>
              )}

              {/* Match Started or Countdown */}
              {matchUrl ? (
                <>
                  <div className="mb-4">
                    <span className="text-lg text-green-400 font-semibold">{t('matchInProgress')}</span>
                  </div>
                  {isParticipant && (
                    <div className="mb-8">
                      <p className="text-gray-300">{t('goToMatchPage')}</p>
                    </div>
                  )}
                  <Link
                    href={matchUrl}
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-full transition-colors text-lg"
                  >
                    {t('goToMatchButton')}
                  </Link>
                </>
              ) : (
                <>
                  {/* Countdown timer */}
                  <div className="mb-2">
                    <span className="text-sm text-gray-400">{t('startsIn')}</span>
                  </div>
                  {scheduledStart && (
                    <MatchTimer scheduledStart={scheduledStart} timeOffset={timeOffset} />
                  )}

                  {/* Player count & Join button */}
                  {currentPlayers !== undefined && maxPlayers !== undefined && (
                    <PlayerCount
                      current={currentPlayers}
                      min={minPlayers}
                      max={maxPlayers}
                      onJoin={onJoinClick}
                      isJoined={isJoined}
                      isJoining={isJoining}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                </>
              )}

              {/* Rules link */}
              <div className="mt-6">
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}

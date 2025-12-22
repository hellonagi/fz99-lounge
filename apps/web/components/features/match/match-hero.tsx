import Link from 'next/link';
import { MatchTimer } from './match-timer';
import { PlayerCount } from './player-count';

interface MatchHeroProps {
  season?: number;
  match?: number;
  league?: string;
  currentPlayers?: number;
  minPlayers?: number;
  maxPlayers?: number;
  countdownSeconds?: number;
  onJoinClick?: () => void;
  isJoined?: boolean;
  isJoining?: boolean;
  errorMessage?: string;
  matchUrl?: string | null;
}

export function MatchHero({
  season,
  match,
  league,
  currentPlayers,
  minPlayers,
  maxPlayers,
  countdownSeconds = 165,
  onJoinClick,
  isJoined = false,
  isJoining = false,
  errorMessage,
  matchUrl,
}: MatchHeroProps) {
  return (
    <section className="relative min-h-[500px] bg-gradient-to-b from-gray-900 to-gray-800 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {errorMessage ? (
            // Error state
            <div className="py-16">
              <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                {errorMessage}
              </h1>
              <p className="text-gray-400">
                Check back soon for the next match
              </p>
            </div>
          ) : (
            // Normal state
            <>
              {/* Season & Match info */}
              <div className="mb-6">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Season {season} • Match {match}
                </span>
              </div>

              {/* League name */}
              <h1 className="text-4xl md:text-6xl font-black text-white mb-3">{league} LEAGUE</h1>

              {/* Match Started or Countdown */}
              {matchUrl ? (
                <>
                  <div className="mb-4">
                    <span className="text-lg text-green-400 font-semibold">Match Has Started!</span>
                  </div>
                  <div className="mb-8">
                    <p className="text-gray-300">Please go to the match page to check the passcode.</p>
                  </div>
                  <Link
                    href={matchUrl}
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-full transition-colors text-lg"
                  >
                    Go to Match Page →
                  </Link>
                </>
              ) : (
                <>
                  {/* Countdown timer */}
                  <div className="mb-2">
                    <span className="text-sm text-gray-400">Starts in</span>
                  </div>
                  <MatchTimer initialSeconds={countdownSeconds} />

                  {/* Player count & Join button */}
                  {currentPlayers !== undefined && maxPlayers !== undefined && (
                    <PlayerCount
                      current={currentPlayers}
                      min={minPlayers}
                      max={maxPlayers}
                      onJoin={onJoinClick}
                      isJoined={isJoined}
                      isJoining={isJoining}
                    />
                  )}
                </>
              )}

              {/* Rules link */}
              <div className="mt-6">
                <p className="text-sm text-gray-400">
                  Please review the{' '}
                  <Link href="/rules" className="text-blue-400 underline">
                    match rules
                  </Link>{' '}
                  before joining
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { LobbyHero } from '@/components/features/lobby/lobby-hero';
import { OngoingMatch } from '@/components/features/match/ongoing-match';
import { RecentMatches } from '@/components/features/match/recent-matches';
import { useLobby } from '@/hooks/useLobby';
import { useLobbyWebSocket } from '@/hooks/useLobbyWebSocket';
import { useLobbyActions } from '@/hooks/useLobbyActions';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function Home() {
  const [wsConnected, setWsConnected] = useState(false);

  // Custom hooks
  const {
    nextLobby,
    setNextLobby,
    loading,
    error,
    setError,
    ongoingMatchInfo,
    fetchData,
  } = useLobby();

  useLobbyWebSocket({
    nextLobby,
    setNextLobby,
    setError,
    fetchData,
    wsConnected,
    setWsConnected,
  });

  const { isUserInLobby, isJoining, handleJoinClick } = useLobbyActions(
    nextLobby,
    setNextLobby
  );

  usePushNotifications();

  // Calculate countdown seconds
  const getCountdownSeconds = () => {
    if (!nextLobby) return 0;
    const now = new Date().getTime();
    const start = new Date(nextLobby.scheduledStart).getTime();
    const diff = Math.floor((start - now) / 1000);
    return Math.max(0, diff);
  };

  // Mock data for sections that don't have API yet
  const mockOngoingMatch = {
    league: 'Knight League',
    totalPlayers: 99,
    participants: ['RacerPro', 'SpeedKing', 'TurboJet', 'BluePhoenix'],
  };

  const mockRecentMatches = [
    {
      league: 'Queen League',
      timeAgo: '5 min ago',
      playerCount: 87,
      avgMmr: 2150,
      results: [
        { position: 1, player: 'SonicRacer_99', points: 1000, mmr: 2195, mmrChange: 45 },
        { position: 2, player: 'FalconMaster', points: 850, mmr: 2105, mmrChange: 20 },
        { position: 3, player: 'SpeedDemon42', points: 720, mmr: 2175, mmrChange: 10 },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show ongoing match message if user has ongoing match
  if (ongoingMatchInfo) {
    const matchUrl = `/matches/${ongoingMatchInfo.mode}/${ongoingMatchInfo.season}/${ongoingMatchInfo.game}`;
    return (
      <>
        <section className="relative min-h-[500px] bg-gradient-to-b from-gray-900 to-gray-800 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="py-16">
                <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
                  Match Has Started
                </h1>
                <p className="text-gray-300 text-lg mb-8">
                  Please go to the match page to check the passcode.
                </p>
                <a
                  href={matchUrl}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-full transition-colors"
                >
                  Go to Match Page
                </a>
              </div>
            </div>
          </div>
        </section>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OngoingMatch
            league={mockOngoingMatch.league}
            totalPlayers={mockOngoingMatch.totalPlayers}
            participants={mockOngoingMatch.participants}
          />

          <RecentMatches matches={mockRecentMatches} />
        </main>
      </>
    );
  }

  return (
    <>
      {error || !nextLobby ? (
        <LobbyHero errorMessage={error || 'No Upcoming Lobby'} />
      ) : (
        <LobbyHero
          season={nextLobby.season?.seasonNumber}
          game={nextLobby.gameNumber}
          league={nextLobby.leagueType}
          currentPlayers={nextLobby.currentPlayers}
          minPlayers={nextLobby.minPlayers}
          maxPlayers={nextLobby.maxPlayers}
          countdownSeconds={getCountdownSeconds()}
          onJoinClick={handleJoinClick}
          isJoined={isUserInLobby}
          isJoining={isJoining}
        />
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OngoingMatch
          league={mockOngoingMatch.league}
          totalPlayers={mockOngoingMatch.totalPlayers}
          participants={mockOngoingMatch.participants}
        />

        <RecentMatches matches={mockRecentMatches} />
      </main>
    </>
  );
}

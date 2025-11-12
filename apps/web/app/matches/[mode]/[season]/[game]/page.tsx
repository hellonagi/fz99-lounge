'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MatchHeaderCard } from '@/components/features/match/match-header-card';
import { MatchPasscodeCard } from '@/components/features/match/match-passcode-card';
import { MatchDetailsCard } from '@/components/features/match/match-details-card';
import { MatchLobbyInfoCard } from '@/components/features/match/match-lobby-info-card';
import { MatchParticipantsCard } from '@/components/features/match/match-participants-card';
import { matchesApi } from '@/lib/api';

interface Match {
  id: string;
  gameMode: string;
  leagueType: string;
  passcode: string | null;
  status: string;
  totalPlayers: number;
  startedAt: string;
  completedAt: string | null;
  lobby: {
    gameNumber: number | null;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    season: {
      seasonNumber: number;
    } | null;
    participants: Array<{
      user: {
        id: string;
        profileId: number;
        displayName: string | null;
        avatarHash: string | null;
      };
    }>;
  };
}

export default function MatchPage() {
  const params = useParams();
  const mode = params.mode as string;
  const season = parseInt(params.season as string, 10);
  const game = parseInt(params.game as string, 10);

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        // Debug: Check if token exists
        const token = localStorage.getItem('token');
        console.log('[Match Page] Token exists:', !!token);
        console.log('[Match Page] Fetching match:', { mode, season, game });

        const response = await matchesApi.getByModeSeasonGame(mode, season, game);
        console.log('[Match Page] Match data received:', {
          hasPasscode: !!response.data.passcode,
          passcode: response.data.passcode,
        });
        setMatch(response.data);
      } catch (err: any) {
        console.error('[Match Page] Error fetching match:', err);
        setError(err.response?.data?.message || 'Failed to load match');
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [mode, season, game]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-xl">{error || 'Match not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header Card */}
          <MatchHeaderCard
            gameMode={match.gameMode}
            seasonNumber={match.lobby.season?.seasonNumber || null}
            gameNumber={match.lobby.gameNumber}
            leagueType={match.leagueType}
            startedAt={match.startedAt}
            completedAt={match.completedAt}
            status={match.status}
          />

          {/* Passcode Card */}
          <MatchPasscodeCard passcode={match.passcode} />

          {/* Match Details Card */}
          <MatchDetailsCard
            gameMode={match.gameMode}
            leagueType={match.leagueType}
            status={match.status}
            totalPlayers={match.totalPlayers}
            startedAt={match.startedAt}
            completedAt={match.completedAt}
          />

          {/* Lobby Info Card */}
          <MatchLobbyInfoCard
            seasonNumber={match.lobby.season?.seasonNumber || null}
            gameNumber={match.lobby.gameNumber}
            minPlayers={match.lobby.minPlayers}
            maxPlayers={match.lobby.maxPlayers}
            currentPlayers={match.lobby.currentPlayers}
          />

          {/* Participants Card */}
          <MatchParticipantsCard participants={match.lobby.participants} />
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { MatchHeaderCard } from '@/components/features/match/match-header-card';
import { MatchPasscodeCard } from '@/components/features/match/match-passcode-card';
import { MatchParticipantsCard } from '@/components/features/match/match-participants-card';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { matchesApi } from '@/lib/api';
import { useMatchSocket } from '@/hooks/useMatchSocket';

interface Match {
  id: string;
  gameMode: string;
  leagueType: string;
  passcode: string | null;
  totalPlayers: number;
  startedAt: string;
  completedAt: string | null;
  lobby: {
    status: string;
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
        discordId: string;
        displayName: string | null;
        avatarHash: string | null;
      };
    }>;
  };
  participants?: Array<{
    user: {
      id: string;
      profileId: number;
      displayName: string | null;
      avatarHash: string | null;
    };
    position: number | null;
    reportedPoints: number | null;
    finalPoints: number | null;
    machine: string;
    assistEnabled: boolean;
  }>;
}

export default function MatchPage() {
  const params = useParams();
  const mode = params.mode as string;
  const season = parseInt(params.season as string, 10);
  const game = parseInt(params.game as string, 10);

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'game1' | 'game2' | 'game3' | 'total'>('game1');

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

  useEffect(() => {
    fetchMatch();
  }, [mode, season, game]);

  const handleScoreSubmitted = () => {
    // Refresh match data after score submission
    fetchMatch();
  };

  // Handle real-time score updates
  const handleScoreUpdated = useCallback((participant: any) => {
    setMatch((prevMatch) => {
      if (!prevMatch) return prevMatch;

      // Update or add participant in the match data
      const updatedParticipants = prevMatch.participants || [];
      const existingIndex = updatedParticipants.findIndex(
        (p) => p.user.id === participant.user.id
      );

      if (existingIndex >= 0) {
        updatedParticipants[existingIndex] = {
          ...updatedParticipants[existingIndex],
          reportedPoints: participant.reportedPoints,
          finalPoints: participant.finalPoints,
        };
      } else {
        updatedParticipants.push(participant);
      }

      return {
        ...prevMatch,
        participants: updatedParticipants,
      };
    });
  }, []);

  // Handle real-time status changes
  const handleStatusChanged = useCallback((status: string) => {
    setMatch((prevMatch) => {
      if (!prevMatch) return prevMatch;
      return {
        ...prevMatch,
        lobby: {
          ...prevMatch.lobby,
          status,
        },
      };
    });
  }, []);

  // Connect to WebSocket for real-time updates
  useMatchSocket({
    matchId: match?.id || '',
    onScoreUpdated: handleScoreUpdated,
    onStatusChanged: handleStatusChanged,
  });

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

  // Mock data for multiple games (will be replaced with real data later)
  const games = [
    { id: 'game1', name: 'Game 1', participants: match.participants || [] },
    { id: 'game2', name: 'Game 2', participants: [] },
    { id: 'game3', name: 'Game 3', participants: [] },
  ];

  // Calculate total scores across all games
  const calculateTotalScores = () => {
    const totals = new Map<string, { user: any; totalPoints: number; gamesPlayed: number }>();

    games.forEach((game) => {
      game.participants.forEach((p) => {
        const userId = p.user.id;
        if (!totals.has(userId)) {
          totals.set(userId, {
            user: p.user,
            totalPoints: 0,
            gamesPlayed: 0,
          });
        }
        const current = totals.get(userId)!;
        if (p.reportedPoints !== null) {
          current.totalPoints += p.reportedPoints;
          current.gamesPlayed += 1;
        }
      });
    });

    return Array.from(totals.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  };

  const renderGameResults = (participants: any[]) => {
    if (!participants || participants.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          No results submitted yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {participants
          .sort((a, b) => {
            // Sort by position first, then by points
            if (a.position && b.position) return a.position - b.position;
            if (a.position) return -1;
            if (b.position) return 1;
            return (b.reportedPoints || 0) - (a.reportedPoints || 0);
          })
          .map((participant) => (
            <div key={participant.user.id} className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-4">
                {/* Position */}
                <div className="text-center min-w-[40px]">
                  {participant.position ? (
                    <span className={`text-lg font-bold ${
                      participant.position <= 3 ? 'text-yellow-400' :
                      participant.position <= 10 ? 'text-gray-300' : 'text-gray-400'
                    }`}>
                      #{participant.position}
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </div>

                {/* Player Name */}
                <div>
                  <span className="text-white font-medium">
                    {participant.user.displayName || `User#${participant.user.profileId}`}
                  </span>
                  {participant.assistEnabled && (
                    <span className="ml-2 text-xs text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded">
                      ASSIST
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Machine */}
                <span className={`text-sm ${
                  participant.machine === 'Blue Falcon' ? 'text-blue-400' :
                  participant.machine === 'Golden Fox' ? 'text-yellow-400' :
                  participant.machine === 'Wild Goose' ? 'text-green-400' :
                  participant.machine === 'Fire Stingray' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {participant.machine}
                </span>

                {/* Points */}
                <div className="text-right min-w-[80px]">
                  {participant.reportedPoints !== null ? (
                    <span className="text-yellow-400 font-bold">{participant.reportedPoints} pts</span>
                  ) : (
                    <span className="text-gray-500">No score</span>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    );
  };

  const renderTotalResults = () => {
    const totalScores = calculateTotalScores();

    if (totalScores.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          No results yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {totalScores.map((entry, index) => (
          <div key={entry.user.id} className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-4">
              {/* Rank */}
              <div className="text-center min-w-[40px]">
                <span className={`text-lg font-bold ${
                  index === 0 ? 'text-yellow-400' :
                  index === 1 ? 'text-gray-300' :
                  index === 2 ? 'text-orange-400' : 'text-gray-400'
                }`}>
                  #{index + 1}
                </span>
              </div>

              {/* Player Name */}
              <div>
                <span className="text-white font-medium">
                  {entry.user.displayName || `User#${entry.user.profileId}`}
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  ({entry.gamesPlayed}/3 games)
                </span>
              </div>
            </div>

            {/* Total Points */}
            <div className="text-right">
              <span className="text-2xl text-yellow-400 font-bold">{entry.totalPoints} pts</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

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
            status={match.lobby.status}
          />

          {/* Passcode Card */}
          <MatchPasscodeCard passcode={match.passcode} />

          {/* Participants Card */}
          <MatchParticipantsCard participants={match.lobby.participants} />

          {/* For TOURNAMENT mode: Show tabs */}
          {match.gameMode === 'TOURNAMENT' ? (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('game1')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'game1'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Game 1
              </button>
              <button
                onClick={() => setActiveTab('game2')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'game2'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Game 2
              </button>
              <button
                onClick={() => setActiveTab('game3')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'game3'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Game 3
              </button>
              <button
                onClick={() => setActiveTab('total')}
                className={`px-6 py-3 text-sm font-medium transition-colors ml-auto ${
                  activeTab === 'total'
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-white'
                    : 'text-yellow-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                🏆 Total
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'game1' && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Game 1 Results</h3>
                  {renderGameResults(games[0].participants)}

                  {/* Score Submission Form - only show when match is IN_PROGRESS */}
                  {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                    <div className="mt-6 pt-6 border-t border-gray-600">
                      <ScoreSubmissionForm
                        mode={mode}
                        season={season}
                        game={game}
                        onScoreSubmitted={handleScoreSubmitted}
                      />
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'game2' && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Game 2 Results</h3>
                  {renderGameResults(games[1].participants)}

                  {/* Score Submission Form - only show when match is IN_PROGRESS */}
                  {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                    <div className="mt-6 pt-6 border-t border-gray-600">
                      <ScoreSubmissionForm
                        mode={mode}
                        season={season}
                        game={game}
                        onScoreSubmitted={handleScoreSubmitted}
                      />
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'game3' && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Game 3 Results</h3>
                  {renderGameResults(games[2].participants)}

                  {/* Score Submission Form - only show when match is IN_PROGRESS */}
                  {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                    <div className="mt-6 pt-6 border-t border-gray-600">
                      <ScoreSubmissionForm
                        mode={mode}
                        season={season}
                        game={game}
                        onScoreSubmitted={handleScoreSubmitted}
                      />
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'total' && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">🏆 Total Ranking</h3>
                  {renderTotalResults()}
                </div>
              )}
            </div>
          </div>
          ) : (
          /* For GP/CLASSIC mode: Simple results display without tabs */
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Match Results</h3>
            {renderGameResults(match.participants || [])}

            {/* Score Submission Form - only show when match is IN_PROGRESS */}
            {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
              <div className="mt-6 pt-6 border-t border-gray-600">
                <ScoreSubmissionForm
                  mode={mode}
                  season={season}
                  game={game}
                  onScoreSubmitted={handleScoreSubmitted}
                />
              </div>
            )}
          </div>
          )}
        </div>
      </main>
    </div>
  );
}
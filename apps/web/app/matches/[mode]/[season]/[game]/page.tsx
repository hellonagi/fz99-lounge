'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { MatchHeaderCard } from '@/components/features/match/match-header-card';
import { MatchPasscodeCard } from '@/components/features/match/match-passcode-card';
import { MatchParticipantsCard } from '@/components/features/match/match-participants-card';
import { MatchResultList } from '@/components/features/match/match-result-list';
import { MatchTotalRanking } from '@/components/features/match/match-total-ranking';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { ScreenshotUploadForm } from '@/components/features/match/screenshot-upload-form';
import { ScreenshotGallery } from '@/components/features/match/screenshot-gallery';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { matchesApi, screenshotsApi } from '@/lib/api';
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
  const { user } = useAuthStore();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<any[]>([]);

  const fetchMatch = async () => {
    try {
      const response = await matchesApi.getByModeSeasonGame(mode, season, game);
      setMatch(response.data);

      // Fetch screenshots
      if (response.data.id) {
        try {
          const screenshotsResponse = await screenshotsApi.getSubmissions(response.data.id);
          setScreenshots(screenshotsResponse.data);
        } catch (err) {
          setScreenshots([]);
        }
      }
    } catch (err: any) {
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
      const updatedParticipants = [...(prevMatch.participants || [])];
      const existingIndex = updatedParticipants.findIndex(
        (p) => p.user.id === participant.user.id
      );

      if (existingIndex >= 0) {
        updatedParticipants[existingIndex] = {
          ...updatedParticipants[existingIndex],
          position: participant.position,
          reportedPoints: participant.reportedPoints,
          finalPoints: participant.finalPoints,
          machine: participant.machine,
          assistEnabled: participant.assistEnabled,
        };
      } else {
        updatedParticipants.push(participant);
      }

      // Sort by reportedPoints (descending) to maintain correct order
      updatedParticipants.sort((a, b) => {
        const aPoints = a.reportedPoints ?? 0;
        const bPoints = b.reportedPoints ?? 0;
        return bPoints - aPoints;
      });

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

  // Calculate total scores for MatchTotalRanking
  const totalScores = calculateTotalScores();

  // Check if current user is 1st place
  const isFirstPlace = () => {
    if (!user || !match.participants || match.participants.length === 0) {
      return false;
    }

    // Sort participants by reportedPoints (desc) and check if current user is first
    const sorted = [...match.participants]
      .filter(p => p.reportedPoints !== null)
      .sort((a, b) => (b.reportedPoints || 0) - (a.reportedPoints || 0));

    if (sorted.length === 0) {
      return false;
    }

    return sorted[0].user.id === user.id;
  };

  // Check if user can upload screenshot (IN_PROGRESS or COMPLETED, but not FINALIZED)
  const canUploadScreenshot =
    (match.lobby.status === 'IN_PROGRESS' || match.lobby.status === 'COMPLETED') &&
    match.lobby.status !== 'FINALIZED' &&
    isFirstPlace();

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
          <Card className="overflow-hidden">
            <Tabs defaultValue="game1">
              <TabsList>
                <TabsTrigger value="game1">Game 1</TabsTrigger>
                <TabsTrigger value="game2">Game 2</TabsTrigger>
                <TabsTrigger value="game3">Game 3</TabsTrigger>
                <TabsTrigger
                  value="total"
                  className="ml-auto text-yellow-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-yellow-500 data-[state=active]:text-white data-[state=active]:border-0"
                >
                  🏆 Total
                </TabsTrigger>
              </TabsList>

              <TabsContent value="game1">
                <h3 className="text-xl font-bold text-white mb-4">Game 1 Results</h3>
                <MatchResultList participants={games[0].participants} />

                {/* Score Submission Form - only show when match is IN_PROGRESS */}
                {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <ScoreSubmissionForm
                      mode={mode}
                      season={season}
                      game={game}
                      participants={match.lobby.participants}
                      onScoreSubmitted={handleScoreSubmitted}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="game2">
                <h3 className="text-xl font-bold text-white mb-4">Game 2 Results</h3>
                <MatchResultList participants={games[1].participants} />

                {/* Score Submission Form - only show when match is IN_PROGRESS */}
                {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <ScoreSubmissionForm
                      mode={mode}
                      season={season}
                      game={game}
                      participants={match.lobby.participants}
                      onScoreSubmitted={handleScoreSubmitted}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="game3">
                <h3 className="text-xl font-bold text-white mb-4">Game 3 Results</h3>
                <MatchResultList participants={games[2].participants} />

                {/* Score Submission Form - only show when match is IN_PROGRESS */}
                {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <ScoreSubmissionForm
                      mode={mode}
                      season={season}
                      game={game}
                      participants={match.lobby.participants}
                      onScoreSubmitted={handleScoreSubmitted}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="total">
                <h3 className="text-xl font-bold text-white mb-4">🏆 Total Ranking</h3>
                <MatchTotalRanking entries={totalScores} />
              </TabsContent>
            </Tabs>
          </Card>
          ) : (
          /* For GP/CLASSIC mode: Simple results display without tabs */
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold text-white mb-4">Match Results</h3>
              <MatchResultList participants={match.participants || []} />

              {/* Score Submission Form - only show when match is IN_PROGRESS */}
              {match.lobby.status === 'IN_PROGRESS' && localStorage.getItem('token') && (
                <div className="mt-6 pt-6 border-t border-gray-600">
                  <ScoreSubmissionForm
                    mode={mode}
                    season={season}
                    game={game}
                    participants={match.lobby.participants}
                    onScoreSubmitted={handleScoreSubmitted}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Screenshot Upload Form - only show for 1st place when match is IN_PROGRESS or COMPLETED (not FINALIZED) */}
          {canUploadScreenshot && (
            <ScreenshotUploadForm
              matchId={match.id}
              onUploadSuccess={fetchMatch}
            />
          )}

          {/* Screenshot Gallery - show all submitted screenshots */}
          {screenshots.length > 0 && (
            <ScreenshotGallery screenshots={screenshots} />
          )}
        </div>
      </main>
    </div>
  );
}
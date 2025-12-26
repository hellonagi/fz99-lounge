'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { MatchHeaderCard } from '@/components/features/match/match-header-card';
import { MatchPasscodeCard } from '@/components/features/match/match-passcode-card';
import { MatchDetailsTable } from '@/components/features/match/match-details-table';
import { ModeratorPanel } from '@/components/features/match/moderator-panel';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { ScreenshotUploadForm } from '@/components/features/match/screenshot-upload-form';
import { ScreenshotGallery } from '@/components/features/match/screenshot-gallery';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { gamesApi, screenshotsApi } from '@/lib/api';
import { useGameSocket } from '@/hooks/useGameSocket';

interface Game {
  id: number;
  category: string;
  inGameMode: string;
  leagueType: string;
  passcode: string | null;
  totalPlayers: number;
  startedAt: string | null;
  completedAt: string | null;
  match: {
    id: number;
    status: string;
    matchNumber: number | null;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    scheduledStart: string;
    deadline: string;
    season: {
      seasonNumber: number;
    } | null;
    participants: Array<{
      user: {
        id: number;
        discordId: string;
        displayName: string | null;
        avatarHash: string | null;
        profile?: { country: string | null } | null;
        seasonStats?: Array<{
          displayRating: number;
        }>;
      };
    }>;
  };
  participants?: Array<{
    user: {
      id: number;
      profileId: number;
      displayName: string | null;
      avatarHash: string | null;
    };
    position: number | null;
    reportedPoints: number | null;
    finalPoints: number | null;
    machine: string;
    assistEnabled: boolean;
    totalScore: number | null;
    eliminatedAtRace: number | null;
    ratingAfter: number | null;
    ratingChange: number | null;
    raceResults?: Array<{
      raceNumber: number;
      position: number | null;
      points: number | null;
      isEliminated: boolean;
    }>;
  }>;
}

export default function GamePage() {
  const params = useParams();
  const category = params.category as string;
  const season = parseInt(params.season as string, 10);
  const match = parseInt(params.match as string, 10);
  const { user } = useAuthStore();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('results');
  const initialTabSet = useRef(false);

  const fetchGame = async () => {
    try {
      const response = await gamesApi.getByCategorySeasonMatch(category, season, match);
      setGame(response.data);

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
      setError(err.response?.data?.message || 'Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGame();
  }, [category, season, match]);

  // Set default tab on first load
  useEffect(() => {
    if (game && !initialTabSet.current) {
      initialTabSet.current = true;
      setActiveTab('results');
    }
  }, [game]);

  const handleScoreSubmitted = () => {
    // Refresh game data and switch to results tab
    fetchGame();
    setActiveTab('results');
  };

  // Handle real-time score updates
  const handleScoreUpdated = useCallback((participant: any) => {
    setGame((prevGame) => {
      if (!prevGame) return prevGame;

      // Update or add participant in the game data
      const updatedParticipants = [...(prevGame.participants || [])];
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
          totalScore: participant.totalScore,
          eliminatedAtRace: participant.eliminatedAtRace,
          raceResults: participant.raceResults,
        };
      } else {
        updatedParticipants.push(participant);
      }

      // Sort: Non-DNF by score, then DNF race 3, then DNF race 2, then DNF race 1
      updatedParticipants.sort((a, b) => {
        const aElim = a.eliminatedAtRace;
        const bElim = b.eliminatedAtRace;

        // Both finished - sort by score
        if (aElim === null && bElim === null) {
          const aScore = a.totalScore ?? a.reportedPoints ?? 0;
          const bScore = b.totalScore ?? b.reportedPoints ?? 0;
          return bScore - aScore;
        }

        // One finished, one DNF
        if (aElim === null) return -1;
        if (bElim === null) return 1;

        // Both DNF - later race = higher rank
        return bElim - aElim;
      });

      return {
        ...prevGame,
        participants: updatedParticipants,
      };
    });
  }, []);

  // Handle real-time status changes
  const handleStatusChanged = useCallback((status: string) => {
    setGame((prevGame) => {
      if (!prevGame) return prevGame;
      return {
        ...prevGame,
        match: {
          ...prevGame.match,
          status,
        },
      };
    });
  }, []);

  // Connect to WebSocket for real-time updates
  useGameSocket({
    gameId: game?.id || 0,
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

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-xl">{error || 'Game not found'}</div>
      </div>
    );
  }

  // Check if current user is 1st place (includes ties)
  const isFirstPlace = () => {
    if (!user || !game.participants || game.participants.length === 0) {
      return false;
    }

    // Sort participants by score (totalScore or reportedPoints)
    const sorted = [...game.participants]
      .filter(p => p.totalScore !== null || p.reportedPoints !== null)
      .sort((a, b) => {
        const aScore = a.totalScore ?? a.reportedPoints ?? 0;
        const bScore = b.totalScore ?? b.reportedPoints ?? 0;
        return bScore - aScore;
      });

    if (sorted.length === 0) {
      return false;
    }

    // Get top score
    const topScore = sorted[0].totalScore ?? sorted[0].reportedPoints ?? 0;

    // Check if current user has the top score (allows ties)
    const userScore = game.participants.find(p => p.user.id === user.id);
    if (!userScore) return false;

    const userPoints = userScore.totalScore ?? userScore.reportedPoints ?? 0;
    return userPoints === topScore;
  };

  // Check if user can upload final score screenshot (IN_PROGRESS only, 1st place only)
  const canUploadScreenshot =
    game.match.status === 'IN_PROGRESS' &&
    isFirstPlace();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 overflow-x-hidden">
      <main className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="space-y-3 sm:space-y-6">
          {/* Header Card */}
          <MatchHeaderCard
            gameMode={game.category}
            seasonNumber={game.match.season?.seasonNumber || null}
            gameNumber={game.match.matchNumber}
            leagueType={game.leagueType}
            startedAt={game.startedAt || game.match.scheduledStart}
            completedAt={game.completedAt}
            status={game.match.status}
          />

          {/* Passcode Card */}
          <MatchPasscodeCard passcode={game.passcode} />

          {/* Results / Moderator Tabs */}
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="results">Results</TabsTrigger>
                {user && (user.role === 'MODERATOR' || user.role === 'ADMIN') && (
                  <TabsTrigger value="moderator" className="text-orange-400">Mod</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="results">
                <MatchDetailsTable
                  gameParticipants={game.participants}
                  matchParticipants={game.match.participants}
                  screenshots={screenshots}
                />
              </TabsContent>

              {user && (user.role === 'MODERATOR' || user.role === 'ADMIN') && (
                <TabsContent value="moderator">
                  <ModeratorPanel
                    gameId={game.id}
                    matchId={game.match.id}
                    matchStatus={game.match.status}
                    participants={game.participants || []}
                    screenshots={screenshots}
                    category={category}
                    season={season}
                    match={match}
                    deadline={game.match.deadline}
                    onUpdate={fetchGame}
                  />
                </TabsContent>
              )}
            </Tabs>
          </Card>

          {/* Score Submission Form - always visible below tabs when IN_PROGRESS */}
          {game.match.status === 'IN_PROGRESS' && user && (
            <Card>
              <CardContent className="pt-6">
                <ScoreSubmissionForm
                  mode={category}
                  season={season}
                  game={match}
                  deadline={game.match.deadline}
                  onScoreSubmitted={handleScoreSubmitted}
                />
              </CardContent>
            </Card>
          )}

          {/* Individual Screenshot Upload Form - all players during match */}
          {game.match.status === 'IN_PROGRESS' && user && (
            <ScreenshotUploadForm
              gameId={game.id}
              type="INDIVIDUAL"
              onUploadSuccess={fetchGame}
            />
          )}

          {/* Final Score Screenshot Upload Form - 1st place only */}
          {canUploadScreenshot && (
            <ScreenshotUploadForm
              gameId={game.id}
              type="FINAL_SCORE"
              onUploadSuccess={fetchGame}
            />
          )}

          {/* Screenshots Section - show final score screenshot if exists */}
          {screenshots.filter(s => s.type === 'FINAL_SCORE').length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold text-white mb-4">Screenshots</h3>
                <ScreenshotGallery
                  screenshots={screenshots.filter(s => s.type === 'FINAL_SCORE')}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

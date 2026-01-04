'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { MatchHeaderCard } from '@/components/features/match/match-header-card';
import { MatchPasscodeCard, SplitVoteStatus } from '@/components/features/match/match-passcode-card';
import { MatchDetailsTable } from '@/components/features/match/match-details-table';
import { ModeratorPanel } from '@/components/features/match/moderator-panel';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { ScreenshotUploadForm } from '@/components/features/match/screenshot-upload-form';
import { ScreenshotGallery } from '@/components/features/match/screenshot-gallery';
import { TrackBanners } from '@/components/features/match/track-banners';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { gamesApi, screenshotsApi } from '@/lib/api';
import { useGameSocket, SplitVoteUpdate, PasscodeRegeneratedUpdate, ParticipantUpdate, ScreenshotUpdate } from '@/hooks/useGameSocket';
import { useTranslations } from 'next-intl';

interface Game {
  id: number;
  category: string;
  inGameMode: string;
  leagueType: string;
  passcode: string | null;
  tracks?: number[] | null;
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
      isDisconnected: boolean;
    }>;
  }>;
}

export default function GamePage() {
  const params = useParams();
  const category = params.category as string;
  const season = parseInt(params.season as string, 10);
  const match = parseInt(params.match as string, 10);
  const { user } = useAuthStore();
  const t = useTranslations('splitVote');

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Array<{
    id: number;
    userId: number;
    imageUrl: string | null;
    type: 'INDIVIDUAL' | 'FINAL_SCORE';
    isVerified: boolean;
    isRejected?: boolean;
    isDeleted?: boolean;
    uploadedAt: string;
    user: { id: number; displayName: string | null; username: string; avatarHash: string | null };
  }>>([]);
  const [activeTab, setActiveTab] = useState<string>('results');
  const [splitVoteStatus, setSplitVoteStatus] = useState<SplitVoteStatus | null>(null);
  const initialTabSet = useRef(false);

  const fetchGame = useCallback(async () => {
    try {
      const response = await gamesApi.getByCategorySeasonMatch(category, season, match);
      setGame(response.data);

      // Fetch screenshots
      if (response.data.id) {
        try {
          const screenshotsResponse = await screenshotsApi.getSubmissions(response.data.id);
          setScreenshots(screenshotsResponse.data);
        } catch {
          setScreenshots([]);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load game';
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || errorMessage);
    } finally {
      setLoading(false);
    }
  }, [category, season, match]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

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
  const handleScoreUpdated = useCallback((participant: ParticipantUpdate) => {
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

  // Handle split vote updates
  const handleSplitVoteUpdated = useCallback((data: SplitVoteUpdate) => {
    setSplitVoteStatus((prev) => ({
      currentVotes: data.currentVotes,
      requiredVotes: data.requiredVotes,
      hasVoted: prev?.hasVoted ?? false,
    }));
  }, []);

  // Handle passcode regeneration
  const handlePasscodeRegenerated = useCallback((data: PasscodeRegeneratedUpdate) => {
    // Update passcode in game state
    setGame((prevGame) => {
      if (!prevGame) return prevGame;
      return {
        ...prevGame,
        passcode: data.passcode,
      };
    });

    // Reset split vote status
    setSplitVoteStatus({
      currentVotes: 0,
      requiredVotes: data.requiredVotes,
      hasVoted: false,
    });

    // Show alert notification
    alert(`${t('newPasscode')}\n${t('newPasscodeDescription', { passcode: data.passcode })}`);
  }, [t]);

  // Handle screenshot updates
  const handleScreenshotUpdated = useCallback((data: ScreenshotUpdate) => {
    setScreenshots((prevScreenshots) => {
      const existingIndex = prevScreenshots.findIndex(
        (s) => s.id === data.id
      );

      const updatedScreenshot = {
        id: data.id,
        userId: data.userId,
        imageUrl: data.imageUrl,
        type: data.type,
        isVerified: data.isVerified,
        isRejected: data.isRejected,
        isDeleted: data.isDeleted,
        uploadedAt: data.uploadedAt,
        user: {
          id: data.user.id,
          displayName: data.user.displayName,
          username: data.user.username,
          avatarHash: null,
        },
      };

      if (existingIndex >= 0) {
        // Update existing screenshot
        const updated = [...prevScreenshots];
        updated[existingIndex] = updatedScreenshot;
        return updated;
      } else {
        // Add new screenshot
        return [...prevScreenshots, updatedScreenshot];
      }
    });
  }, []);

  // Fetch split vote status
  const fetchSplitVoteStatus = useCallback(async () => {
    if (!game || game.match.status !== 'IN_PROGRESS') return;

    try {
      const response = await gamesApi.getSplitVoteStatus(category, season, match);
      setSplitVoteStatus({
        currentVotes: response.data.currentVotes,
        requiredVotes: response.data.requiredVotes,
        hasVoted: response.data.hasVoted,
      });
    } catch (err) {
      // Ignore errors - user might not be authenticated
      console.error('Failed to fetch split vote status:', err);
    }
  }, [game, category, season, match]);

  // Fetch split vote status when game loads and user is participant
  useEffect(() => {
    if (game && user && game.match.status === 'IN_PROGRESS') {
      const isUserParticipant = game.match.participants.some(p => p.user.id === user.id);
      if (isUserParticipant) {
        fetchSplitVoteStatus();
      }
    }
  }, [game, user, fetchSplitVoteStatus]);

  // Connect to WebSocket for real-time updates
  useGameSocket({
    gameId: game?.id || 0,
    onScoreUpdated: handleScoreUpdated,
    onStatusChanged: handleStatusChanged,
    onSplitVoteUpdated: handleSplitVoteUpdated,
    onPasscodeRegenerated: handlePasscodeRegenerated,
    onScreenshotUpdated: handleScreenshotUpdated,
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

  // Check if current user is a participant in this match
  const isParticipant = user && game.match.participants.some(p => p.user.id === user.id);

  // Check if final score screenshot form should be shown (IN_PROGRESS, participant)
  const showFinalScoreForm =
    game.match.status === 'IN_PROGRESS' &&
    isParticipant;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 overflow-x-hidden">
      <main className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="space-y-2 sm:space-y-3">
          {/* Header Card */}
          <MatchHeaderCard
            gameMode={category}
            seasonNumber={game.match.season?.seasonNumber || null}
            gameNumber={game.match.matchNumber}
            leagueType={game.leagueType}
            startedAt={game.startedAt || game.match.scheduledStart}
            completedAt={game.completedAt}
            status={game.match.status}
          />

          {/* Track Banners (CLASSIC only) */}
          {category.toUpperCase() === 'CLASSIC' && (
            <TrackBanners tracks={game.tracks} />
          )}

          {/* Passcode Card */}
          <MatchPasscodeCard
            passcode={game.passcode}
            isParticipant={!!isParticipant}
            matchStatus={game.match.status}
            category={category}
            season={season}
            match={match}
            splitVoteStatus={splitVoteStatus}
            onSplitVote={fetchSplitVoteStatus}
          />

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
                  isClassicMode={category.toLowerCase() === 'classic'}
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
                    tracks={game.tracks}
                    onUpdate={fetchGame}
                  />
                </TabsContent>
              )}
            </Tabs>
          </Card>

          {/* Score Submission Form with integrated Screenshot Upload - visible when IN_PROGRESS, participant only, not on mod tab */}
          {game.match.status === 'IN_PROGRESS' && isParticipant && activeTab !== 'moderator' && (
            <Card>
              <CardContent className="pt-6">
                <ScoreSubmissionForm
                  mode={category}
                  season={season}
                  game={match}
                  deadline={game.match.deadline}
                  onScoreSubmitted={handleScoreSubmitted}
                  gameId={game.id}
                  enableScreenshotUpload={true}
                />
              </CardContent>
            </Card>
          )}

          {/* Final Score Screenshot Upload Form - all participants, not on mod tab */}
          {showFinalScoreForm && activeTab !== 'moderator' && (
            <ScreenshotUploadForm
              gameId={game.id}
              type="FINAL_SCORE"
              disabled={!isFirstPlace()}
              isFirstPlace={isFirstPlace()}
              onUploadSuccess={fetchGame}
            />
          )}

          {/* Screenshots Section - show final score screenshot if exists, not on mod tab */}
          {screenshots.filter(s => s.type === 'FINAL_SCORE').length > 0 && activeTab !== 'moderator' && (
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

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/store/authStore';
import { MatchHeaderCard } from '@/components/features/match/match-header-card';
import { MatchPasscodeCard, SplitVoteStatus } from '@/components/features/match/match-passcode-card';
import { MatchDetailsTable } from '@/components/features/match/match-details-table';
import { ModeratorPanel } from '@/components/features/match/moderator-panel';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { ScreenshotUploadForm } from '@/components/features/match/screenshot-upload-form';
import { ScreenshotGallery } from '@/components/features/match/screenshot-gallery';
import { TrackBanners } from '@/components/features/match/track-banners';
import { TeamAnnouncementPhase } from '@/components/features/match/team-announcement-phase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { gamesApi, screenshotsApi } from '@/lib/api';
import { useGameSocket, SplitVoteUpdate, PasscodeRegeneratedUpdate, ParticipantUpdate, ScreenshotUpdate, TeamAssignedUpdate, PasscodeRevealedUpdate } from '@/hooks/useGameSocket';
import { useTranslations } from 'next-intl';

interface Game {
  id: number;
  category: string;
  inGameMode: string;
  leagueType: string | null;
  passcode: string | null;
  tracks?: number[] | null;
  totalPlayers: number;
  startedAt: string | null;
  completedAt: string | null;
  // TEAM_CLASSIC fields
  teamConfig?: string | null;
  teamScores?: Array<{ teamIndex: number; score: number; rank: number }> | null;
  passcodeRevealTime?: string | null;
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
    // Score verification status (UNSUBMITTED | PENDING | VERIFIED | REJECTED)
    status?: string;
    // Screenshot request
    screenshotRequested?: boolean;
    // TEAM_CLASSIC fields
    teamIndex?: number | null;
    isExcluded?: boolean;
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
  const tScreenshotReminder = useTranslations('screenshotReminder');

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Array<{
    id: number;
    userId: number;
    imageUrl: string | null;
    type: 'INDIVIDUAL' | 'INDIVIDUAL_1' | 'INDIVIDUAL_2' | 'FINAL_SCORE' | 'FINAL_SCORE_1' | 'FINAL_SCORE_2';
    isVerified: boolean;
    isRejected?: boolean;
    isDeleted?: boolean;
    uploadedAt: string;
    user: { id: number; displayName: string | null; username: string; avatarHash: string | null };
  }>>([]);
  const [activeTab, setActiveTab] = useState<string>('results');
  const [splitVoteStatus, setSplitVoteStatus] = useState<SplitVoteStatus | null>(null);
  const initialTabSet = useRef(false);

  // TEAM_CLASSIC state
  const [teamData, setTeamData] = useState<{
    teams: Array<{
      teamIndex: number;
      teamNumber: number;
      color: string;
      colorHex: string;
      userIds: number[];
    }>;
    excludedUserIds: number[];
    passcodeRevealTime: string;
  } | null>(null);
  const [passcodeRevealed, setPasscodeRevealed] = useState(false);

  const fetchGame = useCallback(async () => {
    try {
      const response = await gamesApi.getByCategorySeasonMatch(category, season, match);
      const gameData = response.data;
      setGame(gameData);

      // Initialize team data from API response for TEAM_CLASSIC
      if (category.toUpperCase() === 'TEAM_CLASSIC' && gameData.teamConfig && gameData.participants) {
        // Grid position -> color name/hex (F-ZERO 99 color selection screen)
        const GRID_COLORS: Record<number, string> = {
          1: 'Blue', 2: 'Green', 3: 'Yellow', 4: 'Pink',
          5: 'Red', 6: 'Purple', 8: 'Cyan', 10: 'Orange',
          14: 'White', 15: 'Black',
        };
        const GRID_COLOR_HEX: Record<number, string> = {
          1: '#3B82F6', 2: '#22C55E', 3: '#EAB308', 4: '#EC4899',
          5: '#EF4444', 6: '#A855F7', 8: '#06B6D4', 10: '#F97316',
          14: '#F5F5F5', 15: '#6B7280',
        };

        // Available grid positions (same as API TEAM_GRID_NUMBERS)
        const DEFAULT_GRID_NUMBERS = [1, 2, 3, 4, 5, 6, 8, 10, 14, 15];

        // Parse grid numbers from teamConfig (e.g. "4x3|5,1,8")
        const configParts = (gameData.teamConfig as string).split('|');
        const gridNumbers = configParts.length > 1
          ? configParts[1].split(',').map(Number)
          : [];

        // Build teams from participants
        const teamMap = new Map<number, number[]>();
        const excludedIds: number[] = [];

        gameData.participants.forEach((p: { user: { id: number }; teamIndex?: number | null; isExcluded?: boolean }) => {
          if (p.isExcluded) {
            excludedIds.push(p.user.id);
          } else if (p.teamIndex !== null && p.teamIndex !== undefined) {
            const list = teamMap.get(p.teamIndex) || [];
            list.push(p.user.id);
            teamMap.set(p.teamIndex, list);
          }
        });

        const teams = Array.from(teamMap.entries()).map(([teamIndex, userIds]) => {
          const gridNum = gridNumbers[teamIndex] ?? DEFAULT_GRID_NUMBERS[teamIndex] ?? (teamIndex + 1);
          return {
            teamIndex,
            teamNumber: gridNum,
            color: GRID_COLORS[gridNum] || 'Unknown',
            colorHex: GRID_COLOR_HEX[gridNum] || '#808080',
            userIds,
          };
        });

        if (teams.length > 0) {
          setTeamData({
            teams,
            excludedUserIds: excludedIds,
            passcodeRevealTime: gameData.passcodeRevealTime || '',
          });
        }

        // Check if passcode is already revealed
        if (gameData.passcodeRevealTime) {
          const revealTime = new Date(gameData.passcodeRevealTime).getTime();
          if (Date.now() >= revealTime) {
            setPasscodeRevealed(true);
          }
        }
      }

      // Fetch screenshots
      if (gameData.id) {
        try {
          const screenshotsResponse = await screenshotsApi.getSubmissions(gameData.id);
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
          status: participant.status,
          screenshotRequested: participant.screenshotRequested,
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

  // Handle team assignment (TEAM_CLASSIC)
  const handleTeamAssigned = useCallback((data: TeamAssignedUpdate) => {
    setTeamData({
      teams: data.teams,
      excludedUserIds: data.excludedUserIds,
      passcodeRevealTime: data.passcodeRevealTime,
    });
    setPasscodeRevealed(false);
  }, []);

  // Handle passcode revealed (TEAM_CLASSIC)
  const handlePasscodeRevealedEvent = useCallback((data: PasscodeRevealedUpdate) => {
    setPasscodeRevealed(true);
    setGame((prevGame) => {
      if (!prevGame) return prevGame;
      return {
        ...prevGame,
        passcode: data.passcode,
      };
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
    onTeamAssigned: handleTeamAssigned,
    onPasscodeRevealed: handlePasscodeRevealedEvent,
  });

  // Check if this is a TEAM_CLASSIC match
  const isTeamClassic = category.toUpperCase() === 'TEAM_CLASSIC';

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

  // Check if current user is a participant in this match
  const isParticipant = user && game.match.participants.some(p => p.user.id === user.id);
  const isExcluded = user && game.participants?.some(p => p.user.id === user.id && p.isExcluded);

  // Check if user has screenshot request
  const userScreenshotRequested = game.participants?.find(p => p.user.id === user?.id)?.screenshotRequested || false;

  return (
    <div className="overflow-x-hidden">
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

          {/* Track Banners (CLASSIC and TEAM_CLASSIC) */}
          {(category.toUpperCase() === 'CLASSIC' || isTeamClassic) && (
            <TrackBanners tracks={game.tracks} />
          )}

          {/* Passcode Card - hide from excluded players */}
          {!isExcluded && (
            <MatchPasscodeCard
              passcode={game.passcode}
              isParticipant={!!isParticipant}
              matchStatus={game.match.status}
              category={category}
              season={season}
              match={match}
              splitVoteStatus={splitVoteStatus}
              onSplitVote={fetchSplitVoteStatus}
              passcodeRevealTime={isTeamClassic ? game.passcodeRevealTime : undefined}
              onPasscodeRevealed={() => {
                setPasscodeRevealed(true);
                fetchGame();
              }}
            />
          )}

          {/* TEAM_CLASSIC: Team Info (always show when team data available) */}
          {isTeamClassic && teamData && teamData.teams.length > 0 && (() => {
            // Calculate MVP user IDs (per-team highest scorer) for FINALIZED matches
            const mvpUserIds = new Set<number>();
            if (game.match.status === 'FINALIZED' && game.participants) {
              const teamGroups = new Map<number, { userId: number; score: number }[]>();
              for (const p of game.participants) {
                if (p.teamIndex == null || p.isExcluded) continue;
                const group = teamGroups.get(p.teamIndex) || [];
                group.push({ userId: p.user.id, score: p.totalScore ?? 0 });
                teamGroups.set(p.teamIndex, group);
              }
              for (const [, members] of teamGroups) {
                const maxScore = Math.max(...members.map(m => m.score));
                if (maxScore > 0) {
                  members.filter(m => m.score === maxScore).forEach(m => mvpUserIds.add(m.userId));
                }
              }
            }
            return (
            <TeamAnnouncementPhase
              teams={teamData.teams.map((team) => ({
                ...team,
                members: team.userIds.map((userId) => {
                  const participant = game.match.participants.find(
                    (p) => p.user.id === userId
                  );
                  return {
                    userId,
                    displayName: participant?.user.displayName || null,
                    avatarHash: participant?.user.avatarHash || null,
                  };
                }),
              }))}
              excludedUserIds={teamData.excludedUserIds}
              excludedUsers={teamData.excludedUserIds.map((userId) => {
                const participant = game.match.participants.find(
                  (p) => p.user.id === userId
                );
                return {
                  userId,
                  displayName: participant?.user.displayName || null,
                  avatarHash: participant?.user.avatarHash || null,
                };
              })}
              currentUserId={user?.id || null}
              isPasscodeRevealed={passcodeRevealed}
              totalParticipants={game.match.participants.length}
              mvpUserIds={mvpUserIds}
            />
            );
          })()}

          {/* Screenshot Reminder for Participants */}
          {isParticipant && game.match.status === 'IN_PROGRESS' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{tScreenshotReminder('title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400 mb-4">
                  {tScreenshotReminder('description')}
                </p>
                <div className="flex gap-2">
                  <div className="relative w-1/2 max-w-[200px]">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                      <Image
                        src="/rules/cmini_example_1.webp"
                        alt="Example screenshot 1"
                        fill
                        sizes="200px"
                        className="object-contain"
                      />
                    </div>
                  </div>
                  <div className="relative w-1/2 max-w-[200px]">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                      <Image
                        src="/rules/cmini_example_2.webp"
                        alt="Example screenshot 2"
                        fill
                        sizes="200px"
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                  isClassicMode={category.toLowerCase() === 'classic' || isTeamClassic}
                  isTeamClassic={isTeamClassic}
                  teamScores={game.teamScores ?? undefined}
                  teamColors={teamData?.teams.reduce((acc, team) => {
                    acc[team.teamIndex] = team.colorHex;
                    return acc;
                  }, {} as Record<number, string>)}
                />
              </TabsContent>

              {user && (user.role === 'MODERATOR' || user.role === 'ADMIN') && (
                <TabsContent value="moderator">
                  <ModeratorPanel
                    gameId={game.id}
                    matchId={game.match.id}
                    matchStatus={game.match.status}
                    participants={(game.participants || []).filter(p => !p.isExcluded)}
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

          {/* Score Submission Form - visible when IN_PROGRESS, participant only, not on mod tab */}
          {game.match.status === 'IN_PROGRESS' && isParticipant && !isExcluded && activeTab !== 'moderator' && (
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

          {/* Screenshot Upload Form - only when screenshot requested by moderator */}
          {game.match.status === 'IN_PROGRESS' && isParticipant && userScreenshotRequested && activeTab !== 'moderator' && (
            <ScreenshotUploadForm
              gameId={game.id}
              onUploadSuccess={fetchGame}
              screenshotRequested={true}
            />
          )}

          {/* Screenshots Section - show final score screenshot if exists, not on mod tab */}
          {screenshots.filter(s => s.type === 'FINAL_SCORE' || s.type === 'FINAL_SCORE_1' || s.type === 'FINAL_SCORE_2').length > 0 && activeTab !== 'moderator' && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold text-white mb-4">Screenshots</h3>
                <ScreenshotGallery
                  screenshots={screenshots.filter(s => s.type === 'FINAL_SCORE' || s.type === 'FINAL_SCORE_1' || s.type === 'FINAL_SCORE_2')}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

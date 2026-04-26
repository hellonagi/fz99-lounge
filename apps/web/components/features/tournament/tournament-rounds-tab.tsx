'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { KeyRound, Loader2, ChevronRight, Play, EyeOff, Shield, AlertTriangle, MessageSquareWarning, Split } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectAllPositionConflicts,
  type ConflictResult,
} from '@/lib/position-conflict-detector';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { gamesApi, tournamentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useGameSocket, type ParticipantUpdate } from '@/hooks/useGameSocket';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { MatchDetailsTable } from '@/components/features/match/match-details-table';
import type {
  Tournament,
  TournamentRoundConfig,
  Match,
  Game,
} from '@/types';

const LEAGUE_ICON_MAP: Record<string, string> = {
  KNIGHT: '/leagues/knight_64x64.png',
  QUEEN: '/leagues/queen_64x64.png',
  KING: '/leagues/king_64x64.png',
  ACE: '/leagues/ace_64x64.png',
  MIRROR_KNIGHT: '/leagues/mknight_64x64.png',
  MIRROR_QUEEN: '/leagues/mqueen_64x64.png',
  MIRROR_KING: '/leagues/mking_64x64.png',
  MIRROR_ACE: '/leagues/mace_64x64.png',
};

const MODE_ICON_MAP: Record<string, string> = {
  MINI_PRIX: '/leagues/mini_64x64.png',
  CLASSIC_MINI_PRIX: '/leagues/cmini_64x64.png',
};

function getRoundIcon(inGameMode: string, league?: string): string | null {
  if (league && LEAGUE_ICON_MAP[league]) return LEAGUE_ICON_MAP[league];
  if (MODE_ICON_MAP[inGameMode]) return MODE_ICON_MAP[inGameMode];
  return null;
}

function getFormMode(inGameMode: string): string {
  return ['GRAND_PRIX', 'MIRROR_GRAND_PRIX', 'MINI_PRIX'].includes(inGameMode)
    ? 'gp'
    : 'classic';
}

interface TournamentRoundsTabProps {
  tournament: Tournament;
  onUpdate: () => void;
}

export function TournamentRoundsTab({ tournament, onUpdate }: TournamentRoundsTabProps) {
  const t = useTranslations('tournament');
  const format = useFormatter();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const matches = tournament.season?.matches || [];

  // Priority: URL param > IN_PROGRESS round > overall
  const inProgressMatch = matches.find((m) => m.status === 'IN_PROGRESS');
  const fallbackRound = inProgressMatch
    ? inProgressMatch.matchNumber!.toString()
    : 'overall';
  const currentRound = searchParams.get('round') || fallbackRound;

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('round', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    onUpdate();
  }, [searchParams, router, pathname, onUpdate]);

  const inProgressRound = inProgressMatch
    ? tournament.rounds.find((r) => r.roundNumber === inProgressMatch.matchNumber)
    : null;
  const inProgressGame = inProgressMatch?.games?.[0];

  // Participant check across all matches (REGISTRATION_CLOSED has no IN_PROGRESS match)
  const isParticipant = matches.some(m => m.participants?.some(p => p.userId === user?.id));

  // Countdown timer
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const passcodeRevealTime = inProgressGame?.passcodeRevealTime;

  // Epoch sentinel means "hidden after reveal" — treat as no countdown
  const isPasscodeHidden = !!passcodeRevealTime && new Date(passcodeRevealTime).getTime() <= 0;

  useEffect(() => {
    if (!passcodeRevealTime || new Date(passcodeRevealTime).getTime() <= 0) {
      setRemainingMs(null);
      return;
    }
    const revealTime = new Date(passcodeRevealTime).getTime();
    const update = () => {
      const diff = revealTime - Date.now();
      setRemainingMs(diff > 0 ? diff : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [passcodeRevealTime]);

  const formatCountdown = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // "Next" banner target: REGISTRATION_CLOSED → round 1, IN_PROGRESS + no reveal → next WAITING round
  const nextWaitingMatch = useMemo(() =>
    matches.filter(m => m.status === 'WAITING').sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))[0],
    [matches],
  );
  const nextBannerRound = useMemo(() => {
    if (tournament.status === 'REGISTRATION_CLOSED') return tournament.rounds[0] ?? null;
    if (tournament.status === 'IN_PROGRESS') {
      if (!passcodeRevealTime && inProgressRound) {
        // Countdown never started → show current round info
        return inProgressRound;
      }
      if (isPasscodeHidden && nextWaitingMatch) {
        // Passcode hidden → show next waiting round info
        return tournament.rounds.find(r => r.roundNumber === nextWaitingMatch.matchNumber) ?? null;
      }
    }
    return null;
  }, [tournament.status, tournament.rounds, passcodeRevealTime, isPasscodeHidden, inProgressRound, nextWaitingMatch]);

  const nextBannerTime = useMemo(() => {
    if (!nextBannerRound) return null;
    const time = new Date(tournament.tournamentDate);
    if (nextBannerRound.offsetMinutes) {
      time.setMinutes(time.getMinutes() + nextBannerRound.offsetMinutes);
    }
    return time;
  }, [nextBannerRound, tournament.tournamentDate]);

  // WebSocket at TournamentRoundsTab level — always mounted regardless of active tab
  const allGameIds = useMemo(() =>
    matches.map(m => m.games?.[0]?.id).filter((id): id is number => !!id),
    [matches],
  );

  // Split vote state
  const [splitVoteStatus, setSplitVoteStatus] = useState<{
    currentVotes: number;
    requiredVotes: number;
    hasVoted: boolean;
  } | null>(null);
  const [voting, setVoting] = useState(false);
  const [splitThresholdReached, setSplitThresholdReached] = useState(false);

  useGameSocket({
    gameId: allGameIds,
    onPasscodeCountdownStarted: () => { setSplitThresholdReached(false); onUpdate(); },
    onPasscodeHidden: () => onUpdate(),
    onStatusChanged: () => onUpdate(),
    onSplitVoteUpdated: (data) => {
      setSplitVoteStatus((prev) => prev ? { ...prev, currentVotes: data.currentVotes, requiredVotes: data.requiredVotes } : prev);
    },
    onSplitVoteThresholdReached: () => setSplitThresholdReached(true),
    onPasscodeRegenerated: () => setSplitThresholdReached(false),
  });

  const showNextBanner = isParticipant && !!nextBannerRound;
  const showCountdownBanner = isParticipant && remainingMs !== null && remainingMs > 0 && inProgressRound;
  const showPasscodeBanner = isParticipant && remainingMs !== null && remainingMs === 0 && inProgressGame?.passcode && inProgressRound;
  const isSplit = (inProgressGame?.passcodeVersion ?? 1) > 1;

  useEffect(() => {
    if (!showPasscodeBanner || !tournament.season) return;
    gamesApi
      .getSplitVoteStatus('tournament', tournament.season.seasonNumber, inProgressMatch!.matchNumber!)
      .then((res) => {
        setSplitVoteStatus(res.data);
        if (res.data.splitNotified) {
          setSplitThresholdReached(true);
        }
      })
      .catch(() => {});
  }, [showPasscodeBanner, tournament.season?.seasonNumber, inProgressMatch?.matchNumber, inProgressGame?.passcodeVersion]);

  const handleSplitVote = async () => {
    if (!tournament.season || !inProgressMatch?.matchNumber) return;
    setVoting(true);
    try {
      await gamesApi.castSplitVote('tournament', tournament.season.seasonNumber, inProgressMatch.matchNumber);
      setSplitVoteStatus((prev) => prev ? { ...prev, hasVoted: true } : prev);
    } catch (e) {
      console.error('Split vote failed', e);
    } finally {
      setVoting(false);
    }
  };

  // Resolve round icon for countdown/revealed banners
  const bannerRoundIcon = inProgressRound
    ? getRoundIcon(inProgressRound.inGameMode, inProgressRound.league)
    : null;

  return (
    <div className="space-y-4">
      {/* Banner — fixed height, 3 states: next / countdown / passcode */}
      {(showNextBanner || showCountdownBanner || showPasscodeBanner) && (() => {
        // Determine which round to show in banner header
        const bannerRound = showNextBanner ? nextBannerRound : inProgressRound;
        return (
          <div className="rounded-lg border text-gray-100 relative bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30 border-indigo-500/30">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/10 to-pink-900/10 pointer-events-none" />
            <div className="relative py-5 flex flex-col items-center justify-center text-center">
              {/* Line 1: Mode / League — Time */}
              <p className="text-sm text-gray-400">
                {bannerRound!.inGameMode.replace(/_/g, ' ')}
                {bannerRound!.league && ` — ${bannerRound!.league.replace(/_/g, ' ')}`}
                {(() => {
                  const roundForTime = showNextBanner ? nextBannerRound : inProgressRound;
                  if (!roundForTime) return null;
                  const t = new Date(tournament.tournamentDate);
                  if (roundForTime.offsetMinutes) t.setMinutes(t.getMinutes() + roundForTime.offsetMinutes);
                  return ` — ${format.dateTime(t, { hour: '2-digit', minute: '2-digit', timeZone })}`;
                })()}
              </p>

              {/* Line 2: Label */}
              <p className="text-sm text-gray-400 mt-1">
                {showNextBanner && t('countdown.passcodeNotice')}
                {showCountdownBanner && (isSplit ? t('countdown.splitNewPasscode') : t('countdown.revealIn'))}
                {showPasscodeBanner && (isSplit ? t('round.splitNewPasscodeRevealed') : t('round.passcode'))}
              </p>

              {/* Line 3: XXXX / countdown / passcode */}
              {showNextBanner && (
                <p className="text-5xl font-black text-gray-500 tracking-wider font-mono mt-1">
                  XXXX
                </p>
              )}
              {showCountdownBanner && (
                <p className="text-5xl font-black text-white tracking-wider font-mono mt-1">
                  {formatCountdown(remainingMs!)}
                </p>
              )}
              {showPasscodeBanner && !splitThresholdReached && (
                <p className="text-5xl font-black text-white tracking-wider font-mono mt-1">
                  {inProgressGame!.passcode}
                </p>
              )}
              {showPasscodeBanner && splitThresholdReached && (
                <p className="text-5xl font-black text-gray-500 tracking-wider font-mono mt-1">
                  XXXX
                </p>
              )}

              {/* Split threshold reached message */}
              {showPasscodeBanner && splitThresholdReached && (
                <p className="text-sm text-red-400 mt-2 whitespace-pre-line">
                  {t('splitVote.splitOccurred')}
                </p>
              )}

              {/* Split vote button + gauge */}
              {showPasscodeBanner && !splitThresholdReached && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-400">{t('splitVote.description')}</p>
                  <Button
                    variant={splitVoteStatus?.hasVoted ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={handleSplitVote}
                    disabled={voting || splitVoteStatus?.hasVoted}
                  >
                    <Split className="w-4 h-4" />
                    {splitVoteStatus?.hasVoted ? t('splitVote.voted') : t('splitVote.button')}
                  </Button>
                  {splitVoteStatus && splitVoteStatus.currentVotes > 0 && (
                    <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${(splitVoteStatus.currentVotes / splitVoteStatus.requiredVotes) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Tabs value={currentRound} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overall">
            Overall
          </TabsTrigger>
          {tournament.rounds.map((round) => {
            const roundMatch = matches.find((m) => m.matchNumber === round.roundNumber);
            const status = roundMatch?.status;
            return (
              <TabsTrigger key={round.roundNumber} value={round.roundNumber.toString()} className="gap-1.5">
                {status === 'IN_PROGRESS' && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
                {status === 'COMPLETED' && (
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                )}
                GP{round.roundNumber}
              </TabsTrigger>
            );
          })}
          {isAdmin && (
            <TabsTrigger value="admin">Admin</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overall" className="px-0 sm:px-0 pb-0 sm:pb-0">
          <OverallStandings tournament={tournament} onUpdate={onUpdate} />
        </TabsContent>

        {tournament.rounds.map((round) => {
          const match = matches.find(
            (m) => m.matchNumber === round.roundNumber,
          );
          return (
            <TabsContent key={round.roundNumber} value={round.roundNumber.toString()} className="px-0 sm:px-0 pb-0 sm:pb-0">
              <RoundContent
                round={round}
                match={match}
                tournament={tournament}
                format={format}
                timeZone={timeZone}
                onUpdate={onUpdate}
              />
            </TabsContent>
          );
        })}

        {isAdmin && (
          <TabsContent value="admin" className="px-0 sm:px-0 pb-0 sm:pb-0">
            <AdminContent
              tournament={tournament}
              matches={matches}
              onUpdate={onUpdate}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

interface RoundContentProps {
  round: TournamentRoundConfig;
  match: Match | undefined;
  tournament: Tournament;
  format: ReturnType<typeof useFormatter>;
  timeZone: string;
  onUpdate: () => void;
}

function RoundContent({ round, match, tournament, format, timeZone, onUpdate }: RoundContentProps) {
  const t = useTranslations('tournament');
  const { user } = useAuthStore();
  const icon = getRoundIcon(round.inGameMode, round.league);

  const game = match?.games?.[0];

  // Local participants state — updated in-place via WebSocket instead of full refetch
  const [localParticipants, setLocalParticipants] = useState(
    game?.participants ?? [],
  );

  // Sync from props when parent does a full refetch (e.g. advance round)
  useEffect(() => {
    if (game?.participants) setLocalParticipants(game.participants);
  }, [game?.participants]);

  // Merge WebSocket payload into local state
  const handleScoreUpdate = (p: ParticipantUpdate) => {
    setLocalParticipants((prev) => {
      const idx = prev.findIndex((x: any) => x.user.id === p.user.id);
      const merged = {
        user: {
          id: p.user.id,
          profileNumber: p.user.profileNumber,
          displayName: p.user.displayName,
          // profile is not in ParticipantUpdate — preserve from existing
          profile: idx >= 0 ? (prev[idx] as any).user?.profile : null,
        },
        machine: p.machine,
        assistEnabled: p.assistEnabled,
        totalScore: p.totalScore,
        eliminatedAtRace: p.eliminatedAtRace,
        raceResults: p.raceResults,
        ratingAfter: p.ratingAfter,
        ratingChange: p.ratingChange,
        status: p.status,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...merged, user: { ...(prev[idx] as any).user, ...merged.user } };
        return next;
      }
      return [...prev, merged as any];
    });
  };

  useGameSocket({
    gameId: (match?.status === 'IN_PROGRESS' || match?.status === 'COMPLETED') && game?.id ? game.id : 0,
    onScoreUpdated: handleScoreUpdate,
    onPasscodeRegenerated: onUpdate,
  });

  const startTime = new Date(tournament.tournamentDate);
  if (round.offsetMinutes) {
    startTime.setMinutes(startTime.getMinutes() + round.offsetMinutes);
  }

  const formattedTime = format.dateTime(startTime, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

  // Round header
  const header = (
    <div className="flex items-center gap-3 mb-4">
      {icon && (
        <Image
          src={icon}
          alt={round.league || round.inGameMode}
          width={28}
          height={28}
          className="shrink-0"
        />
      )}
      <div>
        <h3 className="text-white font-medium flex items-center gap-2">
          {t('roundLabel', { number: round.roundNumber })}
          {match && (
            <Badge
              variant={
                match.status === 'IN_PROGRESS'
                  ? 'destructive'
                  : match.status === 'COMPLETED' || match.status === 'FINALIZED'
                    ? 'success'
                    : 'default'
              }
            >
              {match.status}
            </Badge>
          )}
        </h3>
        <p className="text-sm text-gray-400">
          {round.inGameMode.replace(/_/g, ' ')}
          {round.league && ` / ${round.league.replace(/_/g, ' ')}`}
          {' — '}
          {formattedTime}
        </p>
      </div>
    </div>
  );

  // No match created yet
  if (!match) {
    return (
      <Card>
        <CardContent className="pt-6">
          {header}
          <p className="text-gray-400 text-sm">
            {t('round.notStarted')}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {t('round.scheduled', { time: formattedTime })}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isParticipant = match.participants?.some((p) => p.userId === user?.id);

  const isGpMode = ['GRAND_PRIX', 'MIRROR_GRAND_PRIX', 'MINI_PRIX'].includes(round.inGameMode);
  const isClassicMode = ['CLASSIC', 'MIRROR_CLASSIC', 'CLASSIC_MINI_PRIX'].includes(round.inGameMode);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {header}

        {/* Results table — always show */}
        <MatchDetailsTable
          gameParticipants={localParticipants as any}
          matchParticipants={match.participants as any}
          isGpMode={isGpMode}
          isClassicMode={isClassicMode}
          hideStatus
        />

        {/* Participant: passcode display + score form (below table) */}
        {isParticipant && match.status !== 'WAITING' && tournament.status !== 'COMPLETED' && (
          <ParticipantSection
            tournament={tournament}
            match={match}
            round={round}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface AdminContentProps {
  tournament: Tournament;
  matches: Match[];
  onUpdate: () => void;
}

function AdminContent({ tournament, matches, onUpdate }: AdminContentProps) {
  const t = useTranslations('tournament');
  const td = useTranslations('discord');
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [countdownLoading, setCountdownLoading] = useState(false);
  const [hideLoading, setHideLoading] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitThresholdReached, setSplitThresholdReached] = useState(false);
  const [discordRoleLoading, setDiscordRoleLoading] = useState(false);
  const [discordRoleResult, setDiscordRoleResult] = useState<{
    assigned: number;
    alreadyHad: number;
    notInServer: Array<{ displayName: string; discordId: string }>;
  } | null>(null);

  const inProgressMatch = matches.find((m) => m.status === 'IN_PROGRESS');
  const inProgressGame = inProgressMatch?.games?.[0];

  useGameSocket({
    gameId: inProgressGame?.id ?? 0,
    onSplitVoteThresholdReached: () => setSplitThresholdReached(true),
    onPasscodeRegenerated: () => setSplitThresholdReached(false),
    onPasscodeCountdownStarted: () => setSplitThresholdReached(false),
  });

  const handleAssignDiscordRoles = async () => {
    setDiscordRoleLoading(true);
    try {
      const res = await tournamentsApi.assignDiscordRoles(tournament.id);
      setDiscordRoleResult(res.data);
    } catch {
    } finally {
      setDiscordRoleLoading(false);
    }
  };

  const nextWaiting = matches
    .filter((m) => m.status === 'WAITING')
    .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))[0];

  // Show admin panel for REGISTRATION_CLOSED, when IN_PROGRESS match exists,
  // or when there are WAITING matches that need to be advanced
  if (tournament.status !== 'REGISTRATION_CLOSED' && !inProgressMatch && !nextWaiting) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-gray-400 text-sm">{t('admin.noInProgress')}</p>
          <DiscordRoleSection
            loading={discordRoleLoading}
            result={discordRoleResult}
            onAssign={handleAssignDiscordRoles}
          />
        </CardContent>
      </Card>
    );
  }

  const inProgressRound = inProgressMatch
    ? tournament.rounds.find((r) => r.roundNumber === inProgressMatch.matchNumber)
    : null;

  const isLastRound = inProgressMatch && !nextWaiting;

  const isPasscodeHidden = inProgressGame?.passcodeRevealTime &&
    new Date(inProgressGame.passcodeRevealTime).getTime() <= 0;

  const passcodeRevealed = inProgressGame?.passcodeRevealTime &&
    !isPasscodeHidden &&
    new Date(inProgressGame.passcodeRevealTime) <= new Date();

  const handleStartCountdown = async () => {
    setCountdownLoading(true);
    try {
      await tournamentsApi.startCountdown(tournament.id);
      // WebSocket (passcodeCountdownStarted / statusChanged) triggers onUpdate
    } catch {
    } finally {
      setCountdownLoading(false);
    }
  };

  const handleHidePasscode = async () => {
    setHideLoading(true);
    try {
      await tournamentsApi.hidePasscode(tournament.id);
      // WebSocket (passcodeHidden) triggers onUpdate
    } catch {
    } finally {
      setHideLoading(false);
    }
  };

  const handleAdvance = async () => {
    const message = isLastRound ? t('admin.confirmFinish') : t('admin.confirmAdvance');
    if (!window.confirm(message)) return;
    setAdvanceLoading(true);
    try {
      await tournamentsApi.advanceRound(tournament.id);
      onUpdate();
    } catch {
    } finally {
      setAdvanceLoading(false);
    }
  };

  const handleNotifySplit = async () => {
    setSplitLoading(true);
    try {
      await tournamentsApi.notifySplit(tournament.id);
    } catch {
    } finally {
      setSplitLoading(false);
    }
  };

  // REGISTRATION_CLOSED: show Start GP1 Countdown
  if (tournament.status === 'REGISTRATION_CLOSED') {
    const firstRound = tournament.rounds[0];
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {firstRound && (
            <div>
              <h3 className="text-white font-medium">
                {t('roundLabel', { number: firstRound.roundNumber })}
              </h3>
              <p className="text-sm text-gray-400">
                {firstRound.inGameMode.replace(/_/g, ' ')}
                {firstRound.league && ` / ${firstRound.league.replace(/_/g, ' ')}`}
              </p>
            </div>
          )}
          <Button
            size="sm"
            onClick={handleStartCountdown}
            disabled={countdownLoading}
          >
            {countdownLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            {t('countdown.startGP', { round: firstRound?.roundNumber || 1 })}
          </Button>

          <DiscordRoleSection
            loading={discordRoleLoading}
            result={discordRoleResult}
            onAssign={handleAssignDiscordRoles}
          />
        </CardContent>
      </Card>
    );
  }

  // IN_PROGRESS state
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {inProgressRound && (
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              {t('roundLabel', { number: inProgressRound.roundNumber })}
              <Badge variant="destructive">IN_PROGRESS</Badge>
            </h3>
            <p className="text-sm text-gray-400">
              {inProgressRound.inGameMode.replace(/_/g, ' ')}
              {inProgressRound.league && ` / ${inProgressRound.league.replace(/_/g, ' ')}`}
            </p>
          </div>
        )}

        {/* Between GPs: no IN_PROGRESS match but WAITING matches exist */}
        {!inProgressMatch && nextWaiting && (
          <div>
            <p className="text-sm text-gray-400 mb-3">{t('admin.betweenRounds')}</p>
            <Button
              size="sm"
              onClick={handleStartCountdown}
              disabled={countdownLoading}
            >
              {countdownLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              {t('countdown.startGP', { round: nextWaiting.matchNumber! })}
            </Button>
          </div>
        )}

        {splitThresholdReached && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('splitVote.thresholdReached')}</AlertDescription>
          </Alert>
        )}

        {inProgressMatch && <div className="space-y-3">
          {/* Start Countdown — never started (null) or hidden with next round (auto-advance) */}
          {(!inProgressGame?.passcodeRevealTime || (isPasscodeHidden && nextWaiting)) && (
            <Button
              size="sm"
              onClick={handleStartCountdown}
              disabled={countdownLoading}
            >
              {countdownLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              {isPasscodeHidden && nextWaiting
                ? t('countdown.startGP', { round: nextWaiting.matchNumber! })
                : t('countdown.startCountdown')}
            </Button>
          )}

          {/* Hide Passcode — when passcode has been revealed */}
          {passcodeRevealed && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleHidePasscode}
              disabled={hideLoading}
            >
              {hideLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <EyeOff className="h-3 w-3 mr-1" />
              )}
              {t('countdown.hidePasscode')}
            </Button>
          )}

          {/* Notify Split — when passcode has been revealed */}
          {passcodeRevealed && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleNotifySplit}
              disabled={splitLoading}
            >
              {splitLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <MessageSquareWarning className="h-3 w-3 mr-1" />
              )}
              {splitLoading ? t('countdown.notifyingSplit') : t('countdown.notifySplit')}
            </Button>
          )}

          {/* Finish tournament — last round after passcode hidden */}
          {isLastRound && isPasscodeHidden && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleAdvance}
              disabled={advanceLoading}
            >
              {advanceLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1" />
              )}
              {t('admin.finishLast', { current: inProgressMatch!.matchNumber! })}
            </Button>
          )}

          <PasscodeSection
            tournament={tournament}
            match={inProgressMatch!}
            game={inProgressGame}
          />
        </div>}

        <DiscordRoleSection
          loading={discordRoleLoading}
          result={discordRoleResult}
          onAssign={handleAssignDiscordRoles}
        />

        {/* Position Conflict Check per round */}
        <PositionConflictSection
          tournament={tournament}
          matches={matches}
        />
      </CardContent>
    </Card>
  );
}

interface PositionConflictSectionProps {
  tournament: Tournament;
  matches: Match[];
}

function PositionConflictSection({ tournament, matches }: PositionConflictSectionProps) {
  const t = useTranslations('tournament');
  const tConflict = useTranslations('positionConflict');

  const roundsWithConflicts = useMemo(() => {
    return matches
      .filter(m => m.status === 'COMPLETED' || m.status === 'IN_PROGRESS' || m.status === 'FINALIZED')
      .map(match => {
        const game = match.games?.[0];
        if (!game?.participants) return null;
        const round = tournament.rounds.find(r => r.roundNumber === match.matchNumber);
        const isGpMode = round
          ? ['GRAND_PRIX', 'MIRROR_GRAND_PRIX', 'MINI_PRIX'].includes(round.inGameMode)
          : true;
        const allSubmitted = game.participants.every(
          (p: any) => p.status !== 'UNSUBMITTED',
        );
        const conflicts: ConflictResult[] = allSubmitted
          ? detectAllPositionConflicts(game.participants as any, isGpMode)
          : [];
        return { match, allSubmitted, conflicts };
      })
      .filter(Boolean) as Array<{
        match: Match;
        allSubmitted: boolean;
        conflicts: ConflictResult[];
      }>;
  }, [matches, tournament.rounds]);

  if (roundsWithConflicts.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-gray-700 pt-3 mt-3">
      <span className="text-gray-400 text-sm font-medium">
        {tConflict('title')}
      </span>
      {roundsWithConflicts.map(({ match, allSubmitted, conflicts }) => (
        <div
          key={match.id}
          className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
        >
          <span className="text-gray-400 text-sm">
            {t('roundLabel', { number: match.matchNumber })}
          </span>

          {!allSubmitted ? (
            <p className="text-gray-400 text-xs mt-1">
              {tConflict('waitingForSubmissions')}
            </p>
          ) : conflicts.length === 0 ? (
            <p className="text-green-400 text-sm mt-1">
              {tConflict('noConflicts')}
            </p>
          ) : (
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">
                  {tConflict('conflictFound')}
                </span>
              </div>
              {conflicts.map((conflict, idx) => (
                <div
                  key={`${conflict.raceNumber}-${conflict.invalidPosition}-${idx}`}
                  className="p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-sm"
                >
                  <p className="text-yellow-300 font-medium">
                    {tConflict('race', {
                      raceNumber: conflict.raceNumber,
                    })}
                  </p>
                  <ul className="ml-4 text-yellow-100">
                    {conflict.allInvolvedUsers.map(user => (
                      <li key={user.userId}>
                        - {user.userName}{' '}
                        {tConflict('positionLabel', {
                          position: user.position,
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface PasscodeSectionProps {
  tournament: Tournament;
  match: Match;
  game: Game | undefined;
}

function PasscodeSection({ tournament, match, game }: PasscodeSectionProps) {
  const t = useTranslations('tournament');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPasscodeHidden = !!game?.passcodeRevealTime &&
    new Date(game.passcodeRevealTime).getTime() <= 0;

  const isCountingDown = !!game?.passcodeRevealTime &&
    !isPasscodeHidden &&
    new Date(game.passcodeRevealTime) > new Date();

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await tournamentsApi.regeneratePasscode(tournament.id);
      // WebSocket event triggers parent refetch, no need to update local state
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to regenerate passcode');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      {game?.passcode && !isPasscodeHidden && (
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-gray-300">{t('round.passcode')}:</span>
          <span className="font-mono text-lg text-yellow-400 font-bold">{game.passcode}</span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={generating || isPasscodeHidden || isCountingDown}
      >
        {generating ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            {t('round.generatingPasscode')}
          </>
        ) : (
          t('round.generatePasscode')
        )}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface DiscordRoleSectionProps {
  loading: boolean;
  result: {
    assigned: number;
    alreadyHad: number;
    notInServer: Array<{ displayName: string; discordId: string }>;
  } | null;
  onAssign: () => void;
}

function DiscordRoleSection({ loading, result, onAssign }: DiscordRoleSectionProps) {
  const t = useTranslations('discord');

  return (
    <div className="border-t border-gray-700 pt-3 mt-3 space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onAssign}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Shield className="h-3 w-3 mr-1" />
        )}
        {loading ? t('assigningRoles') : t('assignRoles')}
      </Button>

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">
            {t('assigned', { count: result.assigned })}
            {' / '}
            {t('alreadyHad', { count: result.alreadyHad })}
          </p>

          {result.notInServer.length > 0 && (
            <div className="rounded-md border border-yellow-600/40 bg-yellow-900/20 p-3">
              <div className="flex items-center gap-1.5 text-yellow-400 text-sm font-medium mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('notInServerCount', { count: result.notInServer.length })}
              </div>
              <ul className="text-sm text-gray-300 space-y-0.5">
                {result.notInServer.map((u) => (
                  <li key={u.discordId}>{u.displayName}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ParticipantSectionProps {
  tournament: Tournament;
  match: Match;
  round: TournamentRoundConfig;
}

function ParticipantSection({ tournament, match, round }: ParticipantSectionProps) {
  return (
    <div className="space-y-3">
      {/* Score submission form — always shown during IN_PROGRESS (re-submission allowed) */}
      {tournament.season && (
        <ScoreSubmissionForm
          mode={getFormMode(round.inGameMode)}
          apiCategory="tournament"
          season={tournament.season.seasonNumber}
          game={match.matchNumber!}
          deadline={match.deadline}
          hideDescription
        />
      )}
    </div>
  );
}

function OverallStandings({ tournament, onUpdate }: { tournament: Tournament; onUpdate: () => void }) {
  const t = useTranslations('tournament');
  const matches = tournament.season?.matches || [];
  const rounds = tournament.rounds;

  // WebSocket: live score updates + status changes for all games
  const allGameIds = useMemo(() =>
    matches
      .map((m) => m.games?.[0]?.id)
      .filter((id): id is number => !!id),
    [matches],
  );

  const gameIdToRound = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of matches) {
      const gid = m.games?.[0]?.id;
      if (gid && m.matchNumber != null) map.set(gid, m.matchNumber);
    }
    return map;
  }, [matches]);

  // Map: `${userId}-${roundNumber}` → ParticipantUpdate
  const [liveScores, setLiveScores] = useState<Map<string, ParticipantUpdate>>(new Map());

  useEffect(() => {
    setLiveScores(new Map());
  }, [allGameIds.join(',')]);

  const handleScoreUpdate = (p: ParticipantUpdate) => {
    const roundNumber = p.gameId ? gameIdToRound.get(p.gameId) : null;
    if (roundNumber == null) return;
    setLiveScores((prev) => {
      const next = new Map(prev);
      next.set(`${p.user.id}-${roundNumber}`, p);
      return next;
    });
  };

  useGameSocket({
    gameId: allGameIds,
    onScoreUpdated: handleScoreUpdate,
    onStatusChanged: onUpdate,
  });

  const standings = useMemo(() => {
    const playerMap = new Map<number, {
      userId: number;
      displayName: string;
      profileNumber?: number;
      country?: string | null;
      roundScores: Record<number, number | null>;
      roundFinished: Record<number, boolean>;
      total: number;
    }>();

    // 1. Collect all registered players from match.participants
    for (const match of matches) {
      for (const mp of match.participants || []) {
        if (mp.hasWithdrawn) continue;
        if (!playerMap.has(mp.userId)) {
          playerMap.set(mp.userId, {
            userId: mp.userId,
            displayName: mp.user?.displayName || `Player ${mp.userId}`,
            profileNumber: mp.user?.profileNumber,
            country: (mp.user as any)?.profile?.country ?? null,
            roundScores: {},
            roundFinished: {},
            total: 0,
          });
        }
      }
    }

    // 2. Merge scores from game.participants
    for (const match of matches) {
      const roundNumber = match.matchNumber;
      if (roundNumber == null) continue;

      const game = match.games?.[0];
      if (!game?.participants) continue;

      for (const p of game.participants) {
        if (p.status === 'UNSUBMITTED') continue;

        let standing = playerMap.get(p.userId);
        if (!standing) {
          standing = {
            userId: p.userId,
            displayName: p.user?.displayName || `Player ${p.userId}`,
            profileNumber: p.user?.profileNumber,
            country: (p.user as any)?.profile?.country ?? null,
            roundScores: {},
            roundFinished: {},
            total: 0,
          };
          playerMap.set(p.userId, standing);
        }

        const score = p.totalScore ?? 0;
        standing.roundScores[roundNumber] = score;
        standing.roundFinished[roundNumber] = p.eliminatedAtRace == null;
        standing.total += score;
      }
    }

    // 3. Apply live WebSocket overrides
    for (const [key, p] of liveScores) {
      const roundNumber = parseInt(key.split('-')[1], 10);
      const userId = parseInt(key.split('-')[0], 10);
      let standing = playerMap.get(userId);
      if (!standing) {
        standing = {
          userId,
          displayName: p.user.displayName || `Player ${userId}`,
          profileNumber: p.user.profileNumber,
          country: null,
          roundScores: {},
          roundFinished: {},
          total: 0,
        };
        playerMap.set(userId, standing);
      }
      const oldScore = standing.roundScores[roundNumber] ?? 0;
      const newScore = p.totalScore ?? 0;
      standing.roundScores[roundNumber] = newScore;
      standing.roundFinished[roundNumber] = p.eliminatedAtRace == null;
      standing.total = standing.total - oldScore + newScore;
    }

    return Array.from(playerMap.values()).sort((a, b) => b.total - a.total);
  }, [matches, liveScores]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-white font-medium">{t('standings.overall')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 px-2 font-medium w-0">#</th>
                <th className="text-left py-2 px-2 font-medium">{t('standings.player')}</th>
                {rounds.map((r) => (
                  <th key={r.roundNumber} className="text-center py-2 px-1 font-medium whitespace-nowrap">
                    GP{r.roundNumber}
                  </th>
                ))}
                <th className="text-center py-2 px-1 font-medium whitespace-nowrap">{t('standings.finished')}</th>
                <th className="text-right py-2 px-2 font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const rank = i === 0 || s.total < standings[i - 1].total ? i + 1 : i;
                const hasAnyScore = Object.keys(s.roundScores).length > 0;
                return (
                  <tr
                    key={s.userId}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30"
                  >
                    <td className={cn(
                      'py-2 px-2 font-bold',
                      !hasAnyScore ? 'text-gray-500' :
                      rank <= 3 ? 'text-yellow-400' : 'text-gray-100'
                    )}>
                      {hasAnyScore ? rank : '-'}
                    </td>
                    <td className="py-2 px-2 text-white whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`fi fi-${s.country?.toLowerCase() || 'un'}`}
                          title={s.country || 'Unknown'}
                        />
                        {s.profileNumber ? (
                          <Link
                            href={`/profile/${s.profileNumber}`}
                            className="hover:text-blue-400 hover:underline"
                          >
                            {s.displayName}
                          </Link>
                        ) : (
                          <span>{s.displayName}</span>
                        )}
                      </span>
                    </td>
                    {rounds.map((r) => {
                      const score = s.roundScores[r.roundNumber];
                      return (
                        <td
                          key={r.roundNumber}
                          className="py-2 px-1 text-gray-100 text-center"
                        >
                          {score != null ? score : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-1 text-center text-gray-100">
                      {Object.values(s.roundFinished).filter(Boolean).length}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-white">
                      {s.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


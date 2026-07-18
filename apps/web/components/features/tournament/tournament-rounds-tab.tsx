'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, ChevronRight, Play, Shield, AlertTriangle, MessageSquareWarning, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectAllPositionConflicts,
  type ConflictResult,
  type ParticipantForConflict,
} from '@/lib/position-conflict-detector';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { League, divisionForInGameMode, roundDisplayLabel, roundQualifiedLabel } from '@/types';
import { gamesApi, tournamentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useGameSocket, type ParticipantUpdate } from '@/hooks/useGameSocket';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import { MatchDetailsTable } from '@/components/features/match/match-details-table';
import type {
  Tournament,
  TournamentRoundConfig,
  Match,
  MatchParticipant,
  GameParticipant,
  RaceResult,
  ResultStatus,
  User,
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
  return divisionForInGameMode(inGameMode) === 'GP' ? 'gp' : 'classic';
}

// The tournament API always includes the user relation (with profile) and
// score fields on participants; the shared types declare them optional.


type RoundGameParticipant = GameParticipant & {
  user: User;
  totalScore: number | null;
  eliminatedAtRace: number | null;
  raceResults?: Array<
    RaceResult & { position: number | null; points: number | null; isDisconnected: boolean }
  >;
};

type RoundMatchParticipant = MatchParticipant & { user: User };

// Participant row built from a WebSocket score update (no DB ids)
interface LiveParticipantRow {
  user: {
    id: number;
    profileNumber: number;
    displayName: string | null;
    profile?: { country: string | null } | null;
  };
  machine: string;
  assistEnabled: boolean;
  totalScore: number | null;
  eliminatedAtRace: number | null;
  raceResults?: ParticipantUpdate['raceResults'];
  ratingAfter: number | null;
  ratingChange: number | null;
  status?: ResultStatus;
  isCompensated?: boolean;
  isDisqualified?: boolean;
}

type LocalParticipant = RoundGameParticipant | LiveParticipantRow;

// Axios error shape used for user-facing error messages
type ApiErrorLike = { response?: { data?: { message?: string } } };

interface TournamentRoundsTabProps {
  tournament: Tournament;
  onUpdate: () => void;
}

export function TournamentRoundsTab({ tournament, onUpdate }: TournamentRoundsTabProps) {
  const t = useTranslations('tournament');
  const format = useFormatter();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { user } = useAuthStore();
  // Adminタブ(大会進行)はADMIN専用(APIもADMIN専用のため)。
  // Modタブ(スコア編集グリッド)はMODERATORも操作できる
  const isAdmin = user?.role === 'ADMIN';
  const isMod = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const matches = useMemo(
    () => tournament.season?.matches || [],
    [tournament.season?.matches],
  );

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

  // GP部門とClassic部門は別タブ(参加者・順位表を混ぜない)
  const divisionTabs = useMemo(
    () =>
      [
        {
          key: 'gp',
          label: 'GP',
          rounds: tournament.rounds.filter(
            (r) => divisionForInGameMode(r.inGameMode) === 'GP',
          ),
        },
        {
          key: 'classic',
          label: 'Classic',
          rounds: tournament.rounds.filter(
            (r) => divisionForInGameMode(r.inGameMode) === 'CLASSIC',
          ),
        },
      ].filter((d) => d.rounds.length > 0),
    [tournament.rounds],
  );

  const divisionOfRound = useCallback(
    (roundNumber: number) => {
      const round = tournament.rounds.find((r) => r.roundNumber === roundNumber);
      return round && divisionForInGameMode(round.inGameMode) === 'CLASSIC'
        ? 'classic'
        : 'gp';
    },
    [tournament.rounds],
  );

  const currentDivision =
    searchParams.get('division') ??
    (currentRound === 'admin'
      ? 'admin'
      : /^\d+$/.test(currentRound)
        ? divisionOfRound(Number(currentRound))
        : inProgressMatch
          ? divisionOfRound(inProgressMatch.matchNumber!)
          : (divisionTabs[0]?.key ?? 'gp'));

  const handleDivisionChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('division', value);
    params.delete('round');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    onUpdate();
  }, [searchParams, router, pathname, onUpdate]);

  const inProgressRound = inProgressMatch
    ? tournament.rounds.find((r) => r.roundNumber === inProgressMatch.matchNumber)
    : null;

  // Participant check across all matches (REGISTRATION_CLOSED has no IN_PROGRESS match)
  const isParticipant = matches.some(m => m.participants?.some(p => p.userId === user?.id));

  // バナーは常に待機表示(カウントダウンや公開中への切り替えはしない)。
  // 表示対象: REGISTRATION_CLOSED→第1ラウンド、IN_PROGRESS→ライブGP(無ければ次のWAITING)
  const nextWaitingMatch = useMemo(() =>
    matches.filter(m => m.status === 'WAITING').sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))[0],
    [matches],
  );
  const bannerRound = useMemo(() => {
    if (tournament.status === 'REGISTRATION_CLOSED') return tournament.rounds[0] ?? null;
    if (tournament.status === 'IN_PROGRESS') {
      if (inProgressRound) return inProgressRound;
      if (nextWaitingMatch) {
        return tournament.rounds.find(r => r.roundNumber === nextWaitingMatch.matchNumber) ?? null;
      }
    }
    return null;
  }, [tournament.status, tournament.rounds, inProgressRound, nextWaitingMatch]);

  // WebSocket at TournamentRoundsTab level — always mounted regardless of active tab
  const allGameIds = useMemo(() =>
    matches.map(m => m.games?.[0]?.id).filter((id): id is number => !!id),
    [matches],
  );

  useGameSocket({
    gameId: allGameIds,
    onPasscodeCountdownStarted: () => onUpdate(),
    onPasscodeHidden: () => onUpdate(),
    onStatusChanged: () => onUpdate(),
  });

  const showBanner = isParticipant && !!bannerRound;
  // 部門の切り替わりで案内が食い違わないよう、存在する部門すべてを常に表示する
  const passcodeChannelLines = divisionTabs.map((d) => {
    const division = d.key === 'classic' ? 'CLASSIC' : 'GP';
    return {
      key: d.key,
      divisionLabel: d.key === 'classic' ? t('classicDivision') : t('gpDivision'),
      channelName: d.key === 'classic' ? '#passcode-classic' : '#passcode-gp',
      url: tournament.discordPasscodeChannelUrls?.[division] ?? null,
    };
  });

  return (
    <div className="space-y-4">
      {/* Banner — 常に待機表示(対象GPの情報 + Discord公開チャンネルの案内) */}
      {showBanner && (
        <div className="rounded-lg border text-gray-100 relative bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30 border-indigo-500/30">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/10 to-pink-900/10 pointer-events-none" />
          <div className="relative py-5 flex flex-col items-center justify-center text-center space-y-1">
            {/* Discord公開チャンネルの案内 */}
            <p className="text-sm text-gray-400">{t('countdown.passcodeNotice')}</p>
            <p className="text-sm text-gray-400 flex flex-wrap justify-center gap-x-4">
              {passcodeChannelLines.map((line) => (
                <span key={line.key}>
                  {line.divisionLabel}:{' '}
                  {line.url ? (
                    <a
                      href={line.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
                    >
                      {line.channelName}
                    </a>
                  ) : (
                    line.channelName
                  )}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      <Tabs value={currentDivision} onValueChange={handleDivisionChange}>
        <TabsList>
          {divisionTabs.map((d) => (
            <TabsTrigger key={d.key} value={d.key}>
              {d.label}
            </TabsTrigger>
          ))}
          {isMod && (
            <TabsTrigger value="mod">Mod</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="admin">Admin</TabsTrigger>
          )}
        </TabsList>

        {divisionTabs.map((d) => {
          const innerValue = d.rounds.some(
            (r) => r.roundNumber.toString() === currentRound,
          )
            ? currentRound
            : 'overall';
          return (
            <TabsContent key={d.key} value={d.key} className="px-0 sm:px-0 pb-0 sm:pb-0">
              <Tabs value={innerValue} onValueChange={handleTabChange}>
                <TabsList className="flex-wrap">
                  <TabsTrigger value="overall">
                    Overall
                  </TabsTrigger>
                  {d.rounds.map((round) => {
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
                        {roundDisplayLabel(tournament.rounds, round.roundNumber)}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="overall" className="px-0 sm:px-0 pb-0 sm:pb-0">
                  <OverallStandings tournament={tournament} rounds={d.rounds} onUpdate={onUpdate} />
                </TabsContent>

                {d.rounds.map((round) => {
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
              </Tabs>
            </TabsContent>
          );
        })}

        {isMod && (
          <TabsContent value="mod" className="px-0 sm:px-0 pb-0 sm:pb-0">
            <div className="space-y-4">
              {/* 順位重複チェック — スコア修正とセットで使う */}
              <PositionConflictSection
                tournament={tournament}
                matches={matches}
              />
              <ScoreEditGrid
                tournament={tournament}
                matches={matches}
                onUpdate={onUpdate}
              />
            </div>
          </TabsContent>
        )}

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
  const [localParticipants, setLocalParticipants] = useState<LocalParticipant[]>(
    (game?.participants as RoundGameParticipant[] | undefined) ?? [],
  );

  // Sync from props when parent does a full refetch (e.g. advance round)
  useEffect(() => {
    if (game?.participants) setLocalParticipants(game.participants as RoundGameParticipant[]);
  }, [game?.participants]);

  // Merge WebSocket payload into local state
  const handleScoreUpdate = (p: ParticipantUpdate) => {
    setLocalParticipants((prev) => {
      const idx = prev.findIndex((x) => x.user.id === p.user.id);
      const merged: LiveParticipantRow = {
        user: {
          id: p.user.id,
          profileNumber: p.user.profileNumber,
          displayName: p.user.displayName,
          // profile is not in ParticipantUpdate — preserve from existing
          profile: idx >= 0 ? prev[idx].user.profile : null,
        },
        machine: p.machine,
        assistEnabled: p.assistEnabled,
        totalScore: p.totalScore,
        eliminatedAtRace: p.eliminatedAtRace,
        // WS payload rows have no DB ids; the tables only read
        // raceNumber/position/points/isEliminated
        raceResults: p.raceResults,
        ratingAfter: p.ratingAfter,
        ratingChange: p.ratingChange,
        // Keep the existing status when the update omits it
        status: p.status ?? (idx >= 0 ? prev[idx].status : 'UNSUBMITTED'),
        isCompensated: p.isCompensated ?? false,
        isDisqualified: p.isDisqualified ?? false,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...merged, user: { ...prev[idx].user, ...merged.user } };
        return next;
      }
      return [...prev, merged];
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
          {roundDisplayLabel(tournament.rounds, round.roundNumber)}
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

        {/* Participant: score form first — 提出したい人が表の下まで
            スクロールしなくて済むように順位表より上に置く */}
        {isParticipant && match.status !== 'WAITING' && tournament.status !== 'COMPLETED' && (
          <ParticipantSection
            tournament={tournament}
            match={match}
            round={round}
          />
        )}

        {/* Results table — always show */}
        <MatchDetailsTable
          gameParticipants={localParticipants}
          matchParticipants={match.participants as RoundMatchParticipant[] | undefined}
          isGpMode={isGpMode}
          isClassicMode={isClassicMode}
          hideStatus
        />
      </CardContent>
    </Card>
  );
}

interface AdminContentProps {
  tournament: Tournament;
  matches: Match[];
  onUpdate: () => void;
}

const TOURNAMENT_STATUS_FLOW = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'RESULTS_PENDING',
  'COMPLETED',
] as const;

function AdminContent({ tournament, matches, onUpdate }: AdminContentProps) {
  const t = useTranslations('tournament');
  const tAdminTournament = useTranslations('adminTournament');
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [discordRoleLoading, setDiscordRoleLoading] = useState(false);
  const [discordRoleResult, setDiscordRoleResult] = useState<{
    assigned: number;
    alreadyHad: number;
    removed: number;
    notInServer: Array<{ displayName: string; discordId: string }>;
  } | null>(null);
  // 運営操作のエラーは握りつぶさず表示する
  const [adminError, setAdminError] = useState<string | null>(null);

  const inProgressMatch = matches.find((m) => m.status === 'IN_PROGRESS');
  const inProgressGame = inProgressMatch?.games?.[0];

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

  // 大会ステータスの送り/戻し(管理画面一覧と同じ操作を大会ページから行える)
  const statusIdx = TOURNAMENT_STATUS_FLOW.indexOf(
    tournament.status as (typeof TOURNAMENT_STATUS_FLOW)[number],
  );
  const prevStatus = statusIdx > 0 ? TOURNAMENT_STATUS_FLOW[statusIdx - 1] : null;
  const nextStatus =
    statusIdx >= 0 && statusIdx < TOURNAMENT_STATUS_FLOW.length - 1
      ? TOURNAMENT_STATUS_FLOW[statusIdx + 1]
      : null;

  const changeStatus = async (status: Tournament['status'], backward: boolean) => {
    if (
      backward &&
      !window.confirm(
        tAdminTournament('confirmStatusBack', { status: t(`statusLabel.${status}`) }),
      )
    ) {
      return;
    }
    setStatusLoading(true);
    setAdminError(null);
    try {
      await tournamentsApi.update(tournament.id, { status });
      onUpdate();
    } catch (err) {
      setAdminError((err as ApiErrorLike).response?.data?.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const statusControls = (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">{t(`statusLabel.${tournament.status}`)}</Badge>
      {prevStatus && (
        <Button
          size="sm"
          variant="ghost"
          disabled={statusLoading}
          onClick={() => changeStatus(prevStatus, true)}
          className="text-gray-400"
        >
          ← {t(`statusLabel.${prevStatus}`)}
        </Button>
      )}
      {nextStatus && (
        <Button
          size="sm"
          variant="outline"
          disabled={statusLoading}
          onClick={() => changeStatus(nextStatus, false)}
        >
          {t(`statusLabel.${nextStatus}`)} →
        </Button>
      )}
    </div>
    {adminError && (
      <Alert variant="destructive">
        <AlertDescription>{adminError}</AlertDescription>
      </Alert>
    )}
    </div>
  );

  // Show admin panel for REGISTRATION_CLOSED, when IN_PROGRESS match exists,
  // or when there are WAITING matches that need to be advanced
  if (tournament.status !== 'REGISTRATION_CLOSED' && !inProgressMatch && !nextWaiting) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {statusControls}
          <p className="text-gray-400 text-sm">{t('admin.noInProgress')}</p>
          {/* RESULTS_PENDING後でもGPを出し直せる復旧経路 */}
          <CountdownStartForm tournament={tournament} matches={matches} />
          <DiscordRoleSection
            tournamentId={tournament.id}
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

  const passcodeRevealed = inProgressGame?.passcodeRevealTime &&
    new Date(inProgressGame.passcodeRevealTime).getTime() > 0 &&
    new Date(inProgressGame.passcodeRevealTime) <= new Date();

  const handleAdvance = async () => {
    const message = isLastRound ? t('admin.confirmFinish') : t('admin.confirmAdvance');
    if (!window.confirm(message)) return;
    setAdvanceLoading(true);
    setAdminError(null);
    try {
      await tournamentsApi.advanceRound(tournament.id);
      onUpdate();
    } catch (err) {
      setAdminError((err as ApiErrorLike).response?.data?.message || 'Failed to advance round');
    } finally {
      setAdvanceLoading(false);
    }
  };

  const handleNotifySplit = async () => {
    setSplitLoading(true);
    setAdminError(null);
    try {
      await tournamentsApi.notifySplit(tournament.id);
    } catch (err) {
      setAdminError((err as ApiErrorLike).response?.data?.message || 'Failed to notify split');
    } finally {
      setSplitLoading(false);
    }
  };

  // REGISTRATION_CLOSED: countdown form for GP1
  if (tournament.status === 'REGISTRATION_CLOSED') {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {statusControls}
          <CountdownStartForm tournament={tournament} matches={matches} />

          <DiscordRoleSection
            tournamentId={tournament.id}
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
        {statusControls}
        {inProgressRound && (
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              {roundQualifiedLabel(tournament.rounds, inProgressRound.roundNumber)}
              <Badge variant="destructive">IN_PROGRESS</Badge>
            </h3>
            <p className="text-sm text-gray-400">
              {inProgressRound.inGameMode.replace(/_/g, ' ')}
              {inProgressRound.league && ` / ${inProgressRound.league.replace(/_/g, ' ')}`}
            </p>
          </div>
        )}

        {/* Countdown form — operator picks the GP, league and passcode explicitly */}
        <CountdownStartForm tournament={tournament} matches={matches} />

        {inProgressMatch && <div className="flex flex-wrap items-center gap-3">
          {/* Notify Split — 公開状態に関係なくいつでも押せる */}
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

          {/* Finish tournament — 最終GPのパスコード公開後 */}
          {isLastRound && passcodeRevealed && (
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
              {t('admin.finishLast', {
                current: roundQualifiedLabel(tournament.rounds, inProgressMatch!.matchNumber!),
              })}
            </Button>
          )}

        </div>}

        <DiscordRoleSection
            tournamentId={tournament.id}
          loading={discordRoleLoading}
          result={discordRoleResult}
          onAssign={handleAssignDiscordRoles}
        />

      </CardContent>
    </Card>
  );
}

const GRID_MACHINES = ['Blue Falcon', 'Golden Fox', 'Wild Goose', 'Fire Stingray'];

interface GridRowEdit {
  machine: string;
  races: string[];
  compensated: boolean;
  // C ON時のみ有効な補正ポイント(合計を直接上書きする)
  compPoints: string;
  disqualified: boolean;
}

// スプレッドシート風のスコア編集グリッド。ラウンドごとのタブ+行=参加者。
// 各レースの順位とマシンを行単位で編集して保存する(通常のMod代理提出と同じAPI)。
// 順位はゲームの足切りしきい値から脱落を自動判定、切断は "dc" と入力する
function ScoreEditGrid({
  tournament,
  matches,
  onUpdate,
}: {
  tournament: Tournament;
  matches: Match[];
  onUpdate: () => void;
}) {
  const t = useTranslations('tournament');
  const editableRounds = useMemo(
    () =>
      tournament.rounds.filter((r) =>
        matches.some((m) => m.matchNumber === r.roundNumber),
      ),
    [tournament.rounds, matches],
  );
  const defaultRound =
    matches.find((m) => m.status === 'IN_PROGRESS')?.matchNumber?.toString() ??
    editableRounds[0]?.roundNumber.toString() ??
    '';
  const [selectedRound, setSelectedRound] = useState(defaultRound);
  const [edits, setEdits] = useState<
    Record<string, { row: GridRowEdit; base: GridRowEdit }>
  >({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const round = editableRounds.find(
    (r) => r.roundNumber.toString() === selectedRound,
  );
  const match = matches.find((m) => m.matchNumber === round?.roundNumber);
  const game = match?.games?.[0];

  const isGp = round ? getFormMode(round.inGameMode) === 'gp' : true;
  const raceCount = isGp ? 5 : 3;
  const raceMaxPositions = useMemo(
    () => (isGp ? [99, 80, 60, 40, 20] : [20, 16, 12]),
    [isGp],
  );
  const eliminationThresholds = useMemo<(number | null)[]>(
    () => (isGp ? [81, 61, 41, 21, null] : [17, 13, 9]),
    [isGp],
  );

  const players = useMemo(
    () =>
      (match?.participants || [])
        .map((p) => ({
          userId: p.userId,
          displayName: p.user?.displayName || `Player ${p.userId}`,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [match?.participants],
  );

  const participantOf = useCallback(
    (userId: number) =>
      (game?.participants as RoundGameParticipant[] | undefined)?.find(
        (p) => p.userId === userId,
      ),
    [game?.participants],
  );

  // サーバー上の現在値から行の初期値を作る
  const baseRow = useCallback(
    (userId: number): GridRowEdit => {
      const gp = participantOf(userId);
      const races = Array.from({ length: raceCount }, (_, i) => {
        const rr = gp?.raceResults?.find((r) => r.raceNumber === i + 1);
        if (!rr) return '';
        if (rr.isDisconnected) return 'dc';
        const pos = rr.position;
        if (pos == null) return rr.isEliminated ? 'o' : '';
        // しきい値による自動脱落と一致しないクラッシュアウトは "o" 付きで表現
        const threshold = eliminationThresholds[i];
        const autoOut = threshold != null && pos >= threshold;
        return rr.isEliminated && !autoOut ? `${pos}o` : pos.toString();
      });
      return {
        machine: gp?.machine ?? '',
        races,
        compensated: gp?.isCompensated ?? false,
        compPoints: gp?.isCompensated ? (gp?.totalScore?.toString() ?? '') : '',
        disqualified: gp?.isDisqualified ?? false,
      };
    },
    [participantOf, raceCount, eliminationThresholds],
  );

  const editKey = (userId: number) => `${round?.roundNumber}-${userId}`;
  const rowOf = (userId: number): GridRowEdit =>
    edits[editKey(userId)]?.row ?? baseRow(userId);
  const isDirty = (userId: number) => {
    const edit = edits[editKey(userId)];
    return !!edit && JSON.stringify(edit.row) !== JSON.stringify(edit.base);
  };

  const setRow = (userId: number, row: GridRowEdit) => {
    setEdits((prev) => ({
      ...prev,
      // 比較基準は「編集を始めた時点」の値で固定する。
      // 最新のサーバー値と比較すると、編集中にWS更新で合計等が動いたとき
      // 触っていない欄まで変更扱いになり誤って排他エラーになる
      [editKey(userId)]: { row, base: prev[editKey(userId)]?.base ?? baseRow(userId) },
    }));
  };

  const clearEdit = (userId: number) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[editKey(userId)];
      return next;
    });
  };

  // レース入力を検証してAPIペイロードへ変換する。不正があればエラー文字列を返す
  const buildRaceResults = (row: GridRowEdit) => {
    const raceResults: Array<{
      raceNumber: number;
      position?: number;
      isEliminated: boolean;
      isDisconnected: boolean;
    }> = [];
    let eliminated = false;
    for (let i = 1; i <= raceCount; i++) {
      const raw = row.races[i - 1]?.trim().toLowerCase() ?? '';
      if (eliminated || raw === '') {
        raceResults.push({
          raceNumber: i,
          position: undefined,
          isEliminated: false,
          isDisconnected: false,
        });
        continue;
      }
      if (raw === 'dc') {
        raceResults.push({
          raceNumber: i,
          position: undefined,
          isEliminated: false,
          isDisconnected: true,
        });
        eliminated = true;
        continue;
      }
      // 順位のみ or 順位+o(クラッシュアウト) or o単独(順位不明の脱落)
      const m = /^(\d{1,2})?(o)?$/.exec(raw);
      const max = raceMaxPositions[i - 1];
      if (!m || (!m[1] && !m[2])) {
        return `Race ${i}: 1-${max} / 50o / dc`;
      }
      const pos = m[1] ? parseInt(m[1], 10) : undefined;
      if (pos !== undefined && (pos < 1 || pos > max)) {
        return `Race ${i}: 1-${max} / 50o / dc`;
      }
      const threshold = eliminationThresholds[i - 1];
      const isOut =
        !!m[2] || (pos !== undefined && threshold != null && pos >= threshold);
      raceResults.push({
        raceNumber: i,
        position: pos,
        isEliminated: isOut,
        isDisconnected: false,
      });
      if (isOut) eliminated = true;
    }
    return raceResults;
  };

  const saveRow = async (userId: number, displayName: string) => {
    if (!tournament.season || !match || !round) return;
    const entry = edits[editKey(userId)];
    if (!entry) return;
    const { row, base } = entry;
    const season = tournament.season.seasonNumber;
    const matchNumber = match.matchNumber!;

    // 保存は行の最終チェック状態に対して優先順位 DQ > C > 通常 で1系統だけ実行する
    const dqDirty = row.disqualified !== base.disqualified;
    const compApply =
      row.compensated &&
      (row.compensated !== base.compensated ||
        row.compPoints !== base.compPoints);
    const compRemoved = !row.compensated && base.compensated;
    const racesDirty =
      row.machine !== base.machine ||
      JSON.stringify(row.races) !== JSON.stringify(base.races);

    // 1. DQ ON → 失格処理のみ(他の編集はスコアごと消えるため無視)
    if (row.disqualified && dqDirty) {
      if (!window.confirm(t('admin.confirmDq', { name: displayName }))) return;
      setSavingUserId(userId);
      setError(null);
      try {
        await gamesApi.disqualify('tournament', season, matchNumber, userId, true);
        clearEdit(userId);
        onUpdate();
      } catch (err) {
        setError((err as ApiErrorLike).response?.data?.message || 'Failed to disqualify player');
      } finally {
        setSavingUserId(null);
      }
      return;
    }

    // 2. C ON → 補正ポイントで上書き(直前にDQを外していれば先に解除)
    if (compApply) {
      const compScore = parseInt(row.compPoints, 10);
      if (row.compPoints === '' || Number.isNaN(compScore) || compScore < 0) {
        setError(t('admin.gridCompRequired'));
        return;
      }
      setSavingUserId(userId);
      setError(null);
      try {
        if (dqDirty && !row.disqualified) {
          await gamesApi.disqualify('tournament', season, matchNumber, userId, false);
        }
        await gamesApi.overrideScore('tournament', season, matchNumber, userId, compScore, true);
        clearEdit(userId);
        onUpdate();
      } catch (err) {
        setError((err as ApiErrorLike).response?.data?.message || 'Failed to save score');
      } finally {
        setSavingUserId(null);
      }
      return;
    }

    // 3. 両方OFF → 通常状態へ復帰(C/DQ解除)+レース編集の提出を1回の保存で行う
    let raceResults: ReturnType<typeof buildRaceResults> | null = null;
    if (racesDirty) {
      raceResults = buildRaceResults(row);
      if (typeof raceResults === 'string') {
        setError(raceResults);
        return;
      }
    }

    setSavingUserId(userId);
    setError(null);
    try {
      if (dqDirty && !row.disqualified) {
        await gamesApi.disqualify('tournament', season, matchNumber, userId, false);
      }
      if (compRemoved) {
        await gamesApi.setCompensated('tournament', season, matchNumber, userId, false);
      }
      if (Array.isArray(raceResults)) {
        await gamesApi.submitScore('tournament', season, matchNumber, {
          machine: row.machine || undefined,
          assistEnabled: false,
          raceResults,
          targetUserId: userId,
        });
      }
      clearEdit(userId);
      onUpdate();
    } catch (err) {
      setError((err as ApiErrorLike).response?.data?.message || 'Failed to save score');
    } finally {
      setSavingUserId(null);
    }
  };

  if (editableRounds.length === 0) return null;

  const locked = match?.status === 'WAITING';

  return (
    <div className="p-4 bg-orange-950/10 border border-orange-900/50 rounded-lg space-y-4">
      <div>
        <h3 className="text-orange-400 font-medium text-sm">{t('admin.scoreGrid')}</h3>
        <p className="text-xs text-gray-500 mt-1">{t('admin.scoreGridHelp')}</p>
      </div>

      <Tabs value={selectedRound} onValueChange={(v) => { setSelectedRound(v); setError(null); }}>
        <TabsList className="flex-wrap">
          {editableRounds.map((r) => (
            <TabsTrigger key={r.roundNumber} value={r.roundNumber.toString()}>
              {roundQualifiedLabel(tournament.rounds, r.roundNumber)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {locked && (
        <p className="text-xs text-gray-500">{t('admin.scoreGridWaiting')}</p>
      )}

      {match && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-1.5 px-2 font-medium">{t('standings.player')}</th>
                <th className="text-left py-1.5 px-2 font-medium">{t('admin.gridMachine')}</th>
                {Array.from({ length: raceCount }, (_, i) => (
                  <th key={i} className="text-center py-1.5 px-1 font-medium whitespace-nowrap">
                    {t('admin.gridRace', { number: i + 1 })}
                  </th>
                ))}
                <th className="text-center py-1.5 px-1 font-medium">Pts</th>
                <th className="text-center py-1.5 px-1 font-medium">C</th>
                <th className="text-center py-1.5 px-1 font-medium">DQ</th>
                <th className="py-1.5 px-2" />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const row = rowOf(p.userId);
                const dirty = isDirty(p.userId);
                const saving = savingUserId === p.userId;
                const gp = participantOf(p.userId);
                // 3操作(レース編集/C補正/DQ)は排他: 進行中の操作以外は無効化する
                const entry = edits[editKey(p.userId)];
                const racesChanged =
                  !!entry &&
                  (entry.row.machine !== entry.base.machine ||
                    JSON.stringify(entry.row.races) !== JSON.stringify(entry.base.races));
                const raceEditDisabled =
                  locked || saving || row.compensated || row.disqualified;
                return (
                  <tr key={p.userId} className="border-b border-gray-700/50">
                    <td className="py-1 px-2 text-white whitespace-nowrap">{p.displayName}</td>
                    <td className="py-1 px-2">
                      <select
                        value={row.machine}
                        disabled={raceEditDisabled}
                        onChange={(e) => setRow(p.userId, { ...row, machine: e.target.value })}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-</option>
                        {GRID_MACHINES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                    {Array.from({ length: raceCount }, (_, i) => (
                      <td key={i} className="p-0.5 text-center">
                        <Input
                          value={row.races[i] ?? ''}
                          disabled={raceEditDisabled}
                          onChange={(e) => {
                            const races = [...row.races];
                            races[i] = e.target.value.replace(/[^0-9dcoDCO]/g, '').toLowerCase().slice(0, 3);
                            setRow(p.userId, { ...row, races });
                          }}
                          inputMode="numeric"
                          className="w-12 h-7 text-center font-mono mx-auto px-1"
                        />
                      </td>
                    ))}
                    <td className="py-1 px-2 text-center font-mono text-gray-100">
                      {gp?.totalScore ?? '-'}
                    </td>
                    <td className="p-0.5 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <label className="flex items-center gap-1 text-xs font-medium text-orange-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.compensated}
                            disabled={locked || saving || row.disqualified || racesChanged}
                            onChange={(e) =>
                              setRow(p.userId, {
                                ...row,
                                compensated: e.target.checked,
                                // C ONにしたら現在の合計を初期値に、OFFなら空へ
                                compPoints: e.target.checked
                                  ? (row.compPoints || (gp?.totalScore?.toString() ?? ''))
                                  : '',
                              })
                            }
                            className="accent-orange-500"
                          />
                          C
                        </label>
                        <Input
                          value={row.compPoints}
                          disabled={locked || saving || !row.compensated}
                          onChange={(e) =>
                            setRow(p.userId, {
                              ...row,
                              compPoints: e.target.value.replace(/\D/g, '').slice(0, 4),
                            })
                          }
                          inputMode="numeric"
                          placeholder="-"
                          className="w-14 h-7 text-center font-mono px-1"
                        />
                      </span>
                    </td>
                    <td className="py-1 px-2 text-center">
                      <label className="inline-flex items-center gap-1 text-xs font-medium text-red-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.disqualified}
                          disabled={locked || saving || row.compensated || racesChanged}
                          onChange={(e) =>
                            setRow(p.userId, { ...row, disqualified: e.target.checked })
                          }
                          className="accent-red-500"
                        />
                        DQ
                      </label>
                    </td>
                    <td className="py-1 px-2">
                      <Button
                        size="sm"
                        variant={dirty ? 'default' : 'ghost'}
                        onClick={() => saveRow(p.userId, p.displayName)}
                        disabled={locked || !dirty || saving}
                        className="h-7 px-2"
                      >
                        {saving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          t('admin.gridSave')
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CountdownStartFormProps {
  tournament: Tournament;
  matches: Match[];
}

// 運営が対象GP・リーグ・パスコードを明示指定してカウントダウンを開始するフォーム。
// 開始1分後にDiscordへパスコードが公開される(Webには表示されない)
function CountdownStartForm({ tournament, matches }: CountdownStartFormProps) {
  const t = useTranslations('tournament');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // どのGPでも順番に関係なく発火できる(COMPLETEDは再オープン)
  const startableRounds = useMemo(
    () =>
      tournament.rounds
        .map((r) => ({
          round: r,
          match: matches.find((m) => m.matchNumber === r.roundNumber),
        }))
        .filter(
          (x): x is { round: TournamentRoundConfig; match: Match } =>
            !!x.match &&
            ['WAITING', 'IN_PROGRESS', 'COMPLETED'].includes(x.match.status),
        ),
    [tournament.rounds, matches],
  );

  const defaultRoundNumber =
    matches.find((m) => m.status === 'IN_PROGRESS')?.matchNumber ??
    startableRounds.find((x) => x.match.status === 'WAITING')?.round.roundNumber ??
    startableRounds[0]?.round.roundNumber;

  const [roundNumber, setRoundNumber] = useState<string>(
    defaultRoundNumber?.toString() ?? '',
  );
  const [league, setLeague] = useState<string>('NONE');
  const [passcode, setPasscode] = useState<string>('');

  // ラウンド変更時のみリーグ・パスコードの初期値を引き直す
  // (refetchで運営の編集中の値を上書きしないようroundNumberだけを依存にする)
  useEffect(() => {
    const num = parseInt(roundNumber, 10);
    if (!num) return;
    const round = tournament.rounds.find((r) => r.roundNumber === num);
    const game = matches.find((m) => m.matchNumber === num)?.games?.[0];
    setLeague(round?.league ?? 'NONE');
    setPasscode(game?.passcode ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  const passcodeValid = /^\d{4}$/.test(passcode);

  const handleStart = async () => {
    const num = parseInt(roundNumber, 10);
    if (!num || !passcodeValid) return;
    if (!window.confirm(t('countdown.confirmStart', { round: roundQualifiedLabel(tournament.rounds, num), passcode }))) return;
    setLoading(true);
    setError(null);
    try {
      await tournamentsApi.startCountdown(tournament.id, {
        matchNumber: num,
        league: league !== 'NONE' ? league : undefined,
        passcode,
      });
      // WebSocket (passcodeCountdownStarted / statusChanged) triggers onUpdate
    } catch (err) {
      setError((err as ApiErrorLike).response?.data?.message || 'Failed to start countdown');
    } finally {
      setLoading(false);
    }
  };

  if (startableRounds.length === 0) return null;
  if (!['REGISTRATION_CLOSED', 'IN_PROGRESS', 'RESULTS_PENDING'].includes(tournament.status)) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-700 p-3">
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('countdown.roundField')}</Label>
          <Select value={roundNumber} onValueChange={setRoundNumber}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {startableRounds.map(({ round: r, match: m }) => (
                <SelectItem key={r.roundNumber} value={r.roundNumber.toString()}>
                  {roundQualifiedLabel(tournament.rounds, r.roundNumber)}
                  {m.status === 'COMPLETED' ? ` — ${t('countdown.completedSuffix')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('countdown.leagueField')}</Label>
          <Select value={league} onValueChange={setLeague}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">—</SelectItem>
              {Object.values(League).map((l) => (
                <SelectItem key={l} value={l}>
                  {l.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">{t('round.passcode')}</Label>
          <Input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            className="w-24 font-mono"
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleStart}
        disabled={loading || !roundNumber || !passcodeValid}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Play className="h-3 w-3 mr-1" />
        )}
        {t('countdown.startGP', {
          round: roundNumber
            ? roundQualifiedLabel(tournament.rounds, parseInt(roundNumber, 10))
            : '',
        })}
      </Button>
      <p className="text-xs text-gray-500">{t('countdown.startHelp')}</p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface PositionConflictSectionProps {
  tournament: Tournament;
  matches: Match[];
}

function PositionConflictSection({ tournament, matches }: PositionConflictSectionProps) {
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
          (p) => p.status !== 'UNSUBMITTED',
        );
        const conflicts: ConflictResult[] = allSubmitted
          ? detectAllPositionConflicts(
              game.participants as Array<GameParticipant & ParticipantForConflict>,
              isGpMode,
            )
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

  // 問題のあるラウンドだけボックス表示し、それ以外は1行にまとめる
  const conflictRounds = roundsWithConflicts.filter(
    (r) => r.allSubmitted && r.conflicts.length > 0,
  );
  const waitingRounds = roundsWithConflicts.filter((r) => !r.allSubmitted);

  return (
    <div className="space-y-3">
      <span className="text-gray-400 text-sm font-medium">
        {tConflict('title')}
      </span>
      {conflictRounds.length === 0 && (
        <p className="text-green-400 text-sm">{tConflict('noConflicts')}</p>
      )}
      {waitingRounds.length > 0 && (
        <p className="text-gray-500 text-xs">
          {tConflict('waitingForSubmissions')}
          {': '}
          {waitingRounds
            .map((r) => roundQualifiedLabel(tournament.rounds, r.match.matchNumber ?? 0))
            .join(', ')}
        </p>
      )}
      {conflictRounds.map(({ match, conflicts }) => (
        <div
          key={match.id}
          className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
        >
          <span className="text-gray-400 text-sm">
            {roundQualifiedLabel(tournament.rounds, match.matchNumber ?? 0)}
          </span>

          {
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
          }
        </div>
      ))}
    </div>
  );
}

interface DiscordRoleSectionProps {
  tournamentId: number;
  loading: boolean;
  result: {
    assigned: number;
    alreadyHad: number;
    removed: number;
    notInServer: Array<{ displayName: string; discordId: string }>;
  } | null;
  onAssign: () => void;
}

function DiscordRoleSection({ tournamentId, loading, result, onAssign }: DiscordRoleSectionProps) {
  const t = useTranslations('discord');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    division: string;
    channelId: string | null;
    usedFallback: boolean;
    ok: boolean;
  }> | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await tournamentsApi.testDiscord(tournamentId);
      setTestResults(res.data);
    } catch {
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border-t border-gray-700 pt-3 mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
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

        {/* パスコードチャンネル設定の事前確認(メンションなしのテストembedを両部門へ投稿) */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <MessageSquareWarning className="h-3 w-3 mr-1" />
          )}
          {testing ? t('testPosting') : t('testPost')}
        </Button>
      </div>

      {testResults && (
        <div className="text-sm space-y-0.5">
          {testResults.map((r) => (
            <p key={r.division} className="text-gray-300">
              {r.division}:{' '}
              <span className={r.ok ? 'text-green-400' : 'text-red-400'}>
                {r.ok ? t('testOk') : t('testFailed')}
              </span>
              {' — '}
              <span className={r.usedFallback ? 'text-yellow-400' : 'text-gray-400'}>
                {r.usedFallback ? t('testFallback') : t('testDedicated')}
              </span>
            </p>
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">
            {t('assigned', { count: result.assigned })}
            {' / '}
            {t('alreadyHad', { count: result.alreadyHad })}
            {' / '}
            {t('removed', { count: result.removed })}
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
  const t = useTranslations('tournament');
  const { user } = useAuthStore();

  // 提出済みならフォームは畳んでおき、「スコアを修正」で再度開く
  const hasSubmitted = !!match.games?.[0]?.participants?.some(
    (p) => p.userId === user?.id && p.status !== 'UNSUBMITTED',
  );
  const [formOpen, setFormOpen] = useState(!hasSubmitted);

  if (!tournament.season) return null;

  if (!formOpen) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-700 p-3">
        <span className="flex items-center gap-2 text-sm text-gray-300">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          {t('round.scoreSubmitted')}
        </span>
        <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
          {t('round.editScore')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScoreSubmissionForm
        mode={getFormMode(round.inGameMode)}
        apiCategory="tournament"
        season={tournament.season.seasonNumber}
        game={match.matchNumber!}
        deadline={match.deadline}
        hideDescription
        onScoreSubmitted={() => setFormOpen(false)}
      />
    </div>
  );
}

function OverallStandings({ tournament, rounds, onUpdate }: { tournament: Tournament; rounds: TournamentRoundConfig[]; onUpdate: () => void }) {
  const t = useTranslations('tournament');
  // 対象division(表示中タブ)のラウンドに属するマッチだけ集計する
  const roundNumbers = useMemo(
    () => new Set(rounds.map((r) => r.roundNumber)),
    [rounds],
  );
  const matches = useMemo(
    () =>
      (tournament.season?.matches || []).filter(
        (m) => m.matchNumber != null && roundNumbers.has(m.matchNumber),
      ),
    [tournament.season?.matches, roundNumbers],
  );

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

  const allGameIdsKey = allGameIds.join(',');

  useEffect(() => {
    setLiveScores(new Map());
  }, [allGameIdsKey]);

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

  const MACHINE_STYLE: Record<string, { abbr: string; className: string }> = {
    'Blue Falcon':   { abbr: 'BF', className: 'text-blue-400' },
    'Golden Fox':    { abbr: 'GF', className: 'text-yellow-400' },
    'Wild Goose':    { abbr: 'WG', className: 'text-green-400' },
    'Fire Stingray': { abbr: 'FS', className: 'text-pink-400' },
  };

  const standings = useMemo(() => {
    const playerMap = new Map<number, {
      userId: number;
      displayName: string;
      profileNumber?: number;
      country?: string | null;
      roundScores: Record<number, number | null>;
      roundSurvived: Record<number, boolean>;
      roundCompensated: Record<number, boolean>;
      roundDisqualified: Record<number, boolean>;
      roundMachines: Record<number, string | null>;
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
            country: mp.user?.profile?.country ?? null,
            roundScores: {},
            roundSurvived: {},
            roundCompensated: {},
            roundDisqualified: {},
            roundMachines: {},
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
            country: p.user?.profile?.country ?? null,
            roundScores: {},
            roundSurvived: {},
            roundCompensated: {},
            roundDisqualified: {},
            roundMachines: {},
            total: 0,
          };
          playerMap.set(p.userId, standing);
        }

        const score = p.totalScore ?? 0;
        standing.roundScores[roundNumber] = p.totalScore ?? null;
        standing.roundSurvived[roundNumber] = p.totalScore != null && p.eliminatedAtRace == null && !p.isCompensated && !p.isDisqualified;
        standing.roundCompensated[roundNumber] = p.isCompensated ?? false;
        standing.roundDisqualified[roundNumber] = p.isDisqualified ?? false;
        standing.roundMachines[roundNumber] = p.machine ?? null;
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
          roundSurvived: {},
          roundCompensated: {},
          roundDisqualified: {},
          roundMachines: {},
          total: 0,
        };
        playerMap.set(userId, standing);
      }
      const oldScore = standing.roundScores[roundNumber] ?? 0;
      const newScore = p.totalScore ?? 0;
      standing.roundScores[roundNumber] = p.totalScore ?? null;
      standing.roundSurvived[roundNumber] = p.totalScore != null && p.eliminatedAtRace == null && !p.isCompensated && !p.isDisqualified;
      standing.roundCompensated[roundNumber] = p.isCompensated ?? false;
      standing.roundDisqualified[roundNumber] = p.isDisqualified ?? false;
      standing.roundMachines[roundNumber] = p.machine ?? null;
      standing.total = standing.total - oldScore + newScore;
    }

    return Array.from(playerMap.values()).sort((a, b) => {
      const aHas = Object.values(a.roundScores).some(v => v != null);
      const bHas = Object.values(b.roundScores).some(v => v != null);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return b.total - a.total;
    });
  }, [matches, liveScores]);

  const rankedStandings = useMemo(() => {
    let groupRank = 1;
    return standings.map((s, i) => {
      if (i === 0 || s.total < standings[i - 1].total) groupRank = i + 1;
      return {
        ...s,
        rank: groupRank,
        hasAnyScore: Object.values(s.roundScores).some(v => v != null),
      };
    });
  }, [standings]);

  return (
    <div className="space-y-4">
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
                    {roundDisplayLabel(tournament.rounds, r.roundNumber)}
                  </th>
                ))}
                <th className="text-center py-2 px-1 font-medium whitespace-nowrap">{t('standings.finished')}</th>
                <th className="text-right py-2 px-2 font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rankedStandings.map((s) => {
                const { rank, hasAnyScore } = s;
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
                      const machine = s.roundMachines[r.roundNumber];
                      const survived = s.roundSurvived[r.roundNumber];
                      const compensated = s.roundCompensated[r.roundNumber];
                      const disqualified = s.roundDisqualified[r.roundNumber];
                      const machineStyle = machine ? MACHINE_STYLE[machine] : null;
                      return (
                        <td
                          key={r.roundNumber}
                          className="py-2 px-1 text-gray-100 text-center"
                        >
                          {score != null ? (
                            <span className="flex flex-col items-center leading-tight">
                              <span className={survived ? 'text-white font-medium' : 'text-gray-400'}>
                                {score}
                              </span>
                              {disqualified ? (
                                <span className="text-xs font-medium text-red-400">DQ</span>
                              ) : compensated ? (
                                <span className="text-xs font-medium text-orange-400">C</span>
                              ) : machineStyle && (
                                <span className={`text-xs font-medium ${machineStyle.className}`}>
                                  {machineStyle.abbr}
                                </span>
                              )}
                            </span>
                          ) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-1 text-center text-gray-100">
                      {Object.values(s.roundSurvived).filter(Boolean).length}
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
        {standings.some(s => Object.values(s.roundCompensated).some(Boolean)) && (
          <p className="text-xs text-gray-400">
            <span className="text-orange-400 font-medium">C</span>
            {' '}{t('standings.compensatedNote')}
          </p>
        )}
        {standings.some(s => Object.values(s.roundDisqualified).some(Boolean)) && (
          <p className="text-xs text-gray-400">
            <span className="text-red-400 font-medium">DQ</span>
            {' '}{t('standings.disqualifiedNote')}
          </p>
        )}
      </CardContent>
    </Card>

    </div>
  );
}



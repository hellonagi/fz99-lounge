'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { KeyRound, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  }, [searchParams, router, pathname]);

  const inProgressRound = inProgressMatch
    ? tournament.rounds.find((r) => r.roundNumber === inProgressMatch.matchNumber)
    : null;
  const inProgressGame = inProgressMatch?.games?.[0];
  const isParticipant = inProgressMatch?.participants?.some((p) => p.userId === user?.id);

  return (
    <div className="space-y-4">
      {/* Passcode banner — visible to participants only */}
      {isParticipant && inProgressGame?.passcode && inProgressRound && (
        <div className="rounded-lg border text-gray-100 relative bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30 border-indigo-500/30">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/10 to-pink-900/10 pointer-events-none" />
          <div className="relative">
            <div className="p-3 sm:p-6 pt-0 text-center">
              <p className="text-sm text-gray-400 mb-1">
                {inProgressRound.inGameMode.replace(/_/g, ' ')}
                {inProgressRound.league && ` - ${inProgressRound.league.replace(/_/g, ' ')}`}
              </p>
              <p className="text-sm text-gray-400 mb-2">{t('round.passcode')}</p>
              <p className="text-5xl font-black text-white tracking-wider font-mono">{inProgressGame.passcode}</p>
            </div>
          </div>
        </div>
      )}

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
  const [advanceLoading, setAdvanceLoading] = useState(false);

  const inProgressMatch = matches.find((m) => m.status === 'IN_PROGRESS');

  if (!inProgressMatch) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-400 text-sm">{t('admin.noInProgress')}</p>
        </CardContent>
      </Card>
    );
  }

  const inProgressRound = tournament.rounds.find(
    (r) => r.roundNumber === inProgressMatch.matchNumber,
  );
  const game = inProgressMatch.games?.[0];

  const nextWaiting = matches
    .filter((m) => m.status === 'WAITING')
    .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))[0];
  const isLastRound = !nextWaiting;

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

        <div className="space-y-3">
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
            {isLastRound
              ? t('admin.finishLast', { current: inProgressMatch.matchNumber! })
              : t('admin.advanceRound', { current: inProgressMatch.matchNumber!, next: nextWaiting.matchNumber! })}
          </Button>

          <PasscodeSection
            tournament={tournament}
            match={inProgressMatch}
            game={game}
          />
        </div>
      </CardContent>
    </Card>
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
  const [passcode, setPasscode] = useState<string | null>(game?.passcode || null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!tournament.season) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await gamesApi.regeneratePasscode(
        'tournament',
        tournament.season.seasonNumber,
        match.matchNumber!,
      );
      setPasscode(res.data.passcode);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate passcode');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      {passcode && (
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-gray-300">{t('round.passcode')}:</span>
          <span className="font-mono text-lg text-yellow-400 font-bold">{passcode}</span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={generating}
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
            total: 0,
          };
          playerMap.set(p.userId, standing);
        }

        const score = p.totalScore ?? 0;
        standing.roundScores[roundNumber] = score;
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
          total: 0,
        };
        playerMap.set(userId, standing);
      }
      const oldScore = standing.roundScores[roundNumber] ?? 0;
      const newScore = p.totalScore ?? 0;
      standing.roundScores[roundNumber] = newScore;
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
                          className={cn(
                            'py-2 px-1 text-gray-100',
                            score != null ? 'text-right' : 'text-center',
                          )}
                        >
                          {score != null ? score : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-1 text-center text-gray-100">
                      {Object.values(s.roundScores).filter((v) => v != null).length}
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


'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { KeyRound, Loader2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { gamesApi, tournamentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
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
  const isAdmin = user?.role === 'ADMIN';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const matches = tournament.season?.matches || [];

  // Priority: URL param > IN_PROGRESS round > first round
  const inProgressMatch = matches.find((m) => m.status === 'IN_PROGRESS');
  const fallbackRound = inProgressMatch
    ? inProgressMatch.matchNumber!.toString()
    : tournament.rounds[0]?.roundNumber?.toString() || '1';
  const currentRound = searchParams.get('round') || fallbackRound;

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('round', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-4">
      <Tabs value={currentRound} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap">
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
                R{round.roundNumber}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tournament.rounds.map((round) => {
          const match = matches.find(
            (m) => m.matchNumber === round.roundNumber,
          );
          return (
            <TabsContent key={round.roundNumber} value={round.roundNumber.toString()} className="px-0 sm:px-0 pb-0 sm:pb-0">
              <RoundContent
                round={round}
                match={match}
                matches={matches}
                tournament={tournament}
                format={format}
                timeZone={timeZone}
                onUpdate={onUpdate}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

interface RoundContentProps {
  round: TournamentRoundConfig;
  match: Match | undefined;
  matches: Match[];
  tournament: Tournament;
  format: ReturnType<typeof useFormatter>;
  timeZone: string;
  onUpdate: () => void;
}

function RoundContent({ round, match, matches, tournament, format, timeZone, onUpdate }: RoundContentProps) {
  const t = useTranslations('tournament');
  const { user } = useAuthStore();
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const icon = getRoundIcon(round.inGameMode, round.league);

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
        <h3 className="text-white font-medium">
          {t('roundLabel', { number: round.roundNumber })}
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

  const game = match.games?.[0];
  const isParticipant = match.participants?.some((p) => p.userId === user?.id);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  const isGpMode = ['GRAND_PRIX', 'MIRROR_GRAND_PRIX', 'MINI_PRIX'].includes(round.inGameMode);
  const isClassicMode = ['CLASSIC', 'MIRROR_CLASSIC', 'CLASSIC_MINI_PRIX'].includes(round.inGameMode);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {header}

        <div className="flex items-center gap-2">
          <Badge
            variant={
              match.status === 'IN_PROGRESS'
                ? 'destructive'
                : match.status === 'COMPLETED' || match.status === 'FINALIZED'
                  ? 'secondary'
                  : 'default'
            }
          >
            {match.status}
          </Badge>

          {/* Admin: advance round button */}
          {isAdmin && match.status === 'IN_PROGRESS' && (() => {
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
                  ? t('admin.finishLast', { current: match.matchNumber! })
                  : t('admin.advanceRound', { current: match.matchNumber!, next: nextWaiting.matchNumber! })}
              </Button>
            );
          })()}
        </div>

        {/* Admin: passcode generation */}
        {isAdmin && match.status === 'IN_PROGRESS' && (
          <PasscodeSection
            tournament={tournament}
            match={match}
            game={game}
          />
        )}

        {/* Non-admin participant: passcode display */}
        {!isAdmin && isParticipant && match.status === 'IN_PROGRESS' && game?.passcode && (
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-gray-300">{t('round.passcode')}:</span>
            <span className="font-mono text-lg text-yellow-400 font-bold">{game.passcode}</span>
          </div>
        )}

        {/* Results table — show for all statuses with match participants */}
        {match.status !== 'WAITING' && (
          <MatchDetailsTable
            gameParticipants={game?.participants as any}
            matchParticipants={match.participants as any}
            isGpMode={isGpMode}
            isClassicMode={isClassicMode}
          />
        )}

        {/* Participant: passcode display + score form (below table) */}
        {isParticipant && match.status === 'IN_PROGRESS' && (
          <ParticipantSection
            tournament={tournament}
            match={match}
            round={round}
            onUpdate={onUpdate}
          />
        )}
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
  onUpdate: () => void;
}

function ParticipantSection({ tournament, match, round, onUpdate }: ParticipantSectionProps) {
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
          onScoreSubmitted={onUpdate}
        />
      )}
    </div>
  );
}


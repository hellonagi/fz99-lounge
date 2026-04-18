'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { gamesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ScoreSubmissionForm } from '@/components/features/match/score-submission-form';
import type {
  Tournament,
  TournamentRoundConfig,
  Match,
  Game,
  GameParticipant,
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

  const matches = tournament.season?.matches || [];
  const defaultRound = tournament.rounds[0]?.roundNumber?.toString() || '1';

  return (
    <Tabs defaultValue={defaultRound}>
      <TabsList className="flex-wrap">
        {tournament.rounds.map((round) => (
          <TabsTrigger key={round.roundNumber} value={round.roundNumber.toString()}>
            R{round.roundNumber}
          </TabsTrigger>
        ))}
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
              tournament={tournament}
              format={format}
              timeZone={timeZone}
              onUpdate={onUpdate}
            />
          </TabsContent>
        );
      })}
    </Tabs>
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
        </div>

        {/* Admin: passcode generation */}
        {isAdmin && match.status === 'IN_PROGRESS' && (
          <PasscodeSection
            tournament={tournament}
            match={match}
            game={game}
          />
        )}

        {/* Participant: passcode display + score form */}
        {isParticipant && match.status === 'IN_PROGRESS' && (
          <ParticipantSection
            tournament={tournament}
            match={match}
            game={game}
            round={round}
            userId={user!.id}
            onUpdate={onUpdate}
          />
        )}

        {/* Results table for completed matches */}
        {(match.status === 'COMPLETED' || match.status === 'FINALIZED') && game && (
          <ResultsTable game={game} />
        )}

        {/* Show results even if IN_PROGRESS (live results) */}
        {match.status === 'IN_PROGRESS' && game && game.participants && game.participants.length > 0 && (
          <ResultsTable game={game} />
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
  game: Game | undefined;
  round: TournamentRoundConfig;
  userId: number;
  onUpdate: () => void;
}

function ParticipantSection({ tournament, match, game, round, userId, onUpdate }: ParticipantSectionProps) {
  const t = useTranslations('tournament');

  // Check if user already submitted
  const alreadySubmitted = game?.participants?.some(
    (p) => p.userId === userId && p.status !== 'UNSUBMITTED',
  );

  return (
    <div className="space-y-3">
      {/* Passcode display */}
      {game?.passcode && (
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-gray-300">{t('round.passcode')}:</span>
          <span className="font-mono text-lg text-yellow-400 font-bold">{game.passcode}</span>
        </div>
      )}

      {/* Score submission form */}
      {alreadySubmitted ? (
        <p className="text-sm text-green-400">{t('round.alreadySubmitted')}</p>
      ) : (
        tournament.season && (
          <ScoreSubmissionForm
            mode={getFormMode(round.inGameMode)}
            apiCategory="tournament"
            season={tournament.season.seasonNumber}
            game={match.matchNumber!}
            deadline={match.deadline}
            onScoreSubmitted={onUpdate}
          />
        )
      )}
    </div>
  );
}

interface ResultsTableProps {
  game: Game;
}

function ResultsTable({ game }: ResultsTableProps) {
  const t = useTranslations('tournament');

  const participants = game.participants || [];

  // Sort by totalScore descending
  const sorted = [...participants]
    .filter((p) => p.status !== 'UNSUBMITTED')
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-400">{t('round.noResults')}</p>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-2">{t('round.results')}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50 text-left text-gray-400">
              <th className="px-2 py-1.5 w-8">#</th>
              <th className="px-2 py-1.5">{t('standings.player')}</th>
              <th className="px-2 py-1.5 text-right">{t('standings.total')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr
                key={p.id}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1.5">
                  {p.user?.profileNumber ? (
                    <Link
                      href={`/profile/${p.user.profileNumber}`}
                      className="text-gray-300 hover:text-white hover:underline"
                    >
                      {p.user.displayName || `Player ${p.userId}`}
                    </Link>
                  ) : (
                    <span className="text-gray-300">
                      {p.user?.displayName || `Player ${p.userId}`}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-white font-mono">
                  {p.totalScore ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

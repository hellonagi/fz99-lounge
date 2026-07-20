import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RecentTournament,
  RecentTournamentWinner,
  TournamentDivision,
} from '@/types';

export interface DivisionWinnerEntry {
  key: string;
  label: string | null;
  names: string;
  score: number | null;
}

const DIVISION_LABEL: Record<TournamentDivision, string> = {
  [TournamentDivision.GP]: 'GP',
  [TournamentDivision.CLASSIC]: 'Classic',
};

// 部門別の優勝者表示データを組み立てる。divisionsが無い旧レスポンスは合算表示にフォールバック。
// 部門が1つだけの大会はラベルを付けない
export function buildDivisionWinners(
  tournament: RecentTournament,
): DivisionWinnerEntry[] {
  const divisions =
    tournament.divisions && tournament.divisions.length > 0
      ? tournament.divisions
      : [
          {
            division: TournamentDivision.GP,
            winner: tournament.winner,
            winners: tournament.winners ?? [],
          },
        ];
  const showLabel = divisions.length > 1;

  return divisions
    .map((d) => {
      const winnerList: RecentTournamentWinner[] =
        d.winners && d.winners.length > 0 ? d.winners : d.winner ? [d.winner] : [];
      return {
        key: d.division,
        label: showLabel ? DIVISION_LABEL[d.division] : null,
        names: winnerList
          .map((w) => w.displayName || `User#${w.id}`)
          .join(' '),
        score: winnerList[0]?.totalScore ?? null,
      };
    })
    .filter((e) => e.names.length > 0);
}

export function DivisionWinnerLine({
  entry,
  className,
  scoreClassName,
}: {
  entry: DivisionWinnerEntry;
  className?: string;
  scoreClassName?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5 min-w-0', className)}>
      <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      {entry.label && (
        <span className="text-[10px] font-bold tracking-[.1em] uppercase text-gray-500 shrink-0">
          {entry.label}
        </span>
      )}
      <span className="text-sm font-bold text-gray-200 truncate">
        {entry.names}
      </span>
      {entry.score !== null && (
        <span className={cn('shrink-0', scoreClassName)}>
          <span className="font-mono tabular-nums text-sm text-gray-400">
            {entry.score}
          </span>
          <span className="text-[10px] font-bold tracking-[.1em] uppercase text-gray-500 ml-0.5">
            pts
          </span>
        </span>
      )}
    </div>
  );
}

import { InGameMode, TournamentDivision } from './enums';

const GP_MODES: string[] = [
  InGameMode.GRAND_PRIX,
  InGameMode.MIRROR_GRAND_PRIX,
  InGameMode.MINI_PRIX,
];

export interface RoundLike {
  roundNumber: number;
  inGameMode: string;
}

export function divisionForInGameMode(inGameMode: string): TournamentDivision {
  return GP_MODES.includes(inGameMode)
    ? TournamentDivision.GP
    : TournamentDivision.CLASSIC;
}

function divisionRoundIndex(
  rounds: RoundLike[],
  roundNumber: number,
): { division: TournamentDivision; index: number } | null {
  const round = rounds.find((r) => r.roundNumber === roundNumber);
  if (!round) return null;
  const division = divisionForInGameMode(round.inGameMode);
  const sameDivision = rounds
    .filter((r) => divisionForInGameMode(r.inGameMode) === division)
    .sort((a, b) => a.roundNumber - b.roundNumber);
  return {
    division,
    index: sameDivision.findIndex((r) => r.roundNumber === roundNumber) + 1,
  };
}

// 部門タブ内で使う短いラベル(部門内の通し番号)。Classic部門もGP1..GPnと数える。
// matchNumber(全体通し)とは別物なので、API呼び出しには使わないこと
export function roundDisplayLabel(
  rounds: RoundLike[],
  roundNumber: number,
): string {
  const meta = divisionRoundIndex(rounds, roundNumber);
  return meta ? `GP${meta.index}` : `GP${roundNumber}`;
}

// 部門の文脈がない場所(Discord embed・運営フォーム)用の完全ラベル。
// Classic部門のみ接頭辞を付けて区別する(例: Classic GP2)
export function roundQualifiedLabel(
  rounds: RoundLike[],
  roundNumber: number,
): string {
  const meta = divisionRoundIndex(rounds, roundNumber);
  if (!meta) return `GP${roundNumber}`;
  const label = `GP${meta.index}`;
  return meta.division === TournamentDivision.CLASSIC
    ? `Classic ${label}`
    : label;
}

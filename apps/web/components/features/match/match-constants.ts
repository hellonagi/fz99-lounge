export const RATED_THRESHOLDS: Record<string, number> = {
  CLASSIC: 12,
  TEAM_CLASSIC: 12,
  GP: 30,
  TEAM_GP: 30,
  TOURNAMENT: 8,
};

export const START_THRESHOLDS: Record<string, number> = {
  CLASSIC: 4,
  TEAM_CLASSIC: 4,
  GP: 10,
  TEAM_GP: 10,
  TOURNAMENT: 8,
};

export const CATEGORY_LABEL: Record<string, string> = {
  GP: 'GP',
  CLASSIC: 'Classic',
  TEAM_GP: 'Team GP',
  TEAM_CLASSIC: 'Team Classic',
  TOURNAMENT: 'Tournament',
};

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  GP: 'text-amber-400 border-amber-500/50',
  CLASSIC: 'text-purple-400 border-purple-500/50',
  TEAM_CLASSIC: 'text-rose-400 border-rose-500/50',
  TEAM_GP: 'text-cyan-400 border-cyan-500/50',
  TOURNAMENT: 'text-amber-400 border-amber-500/50',
};

export const CATEGORY_COLOR: Record<string, { color: string; soft: string }> = {
  GP:           { color: '#f59e0b', soft: 'rgba(245,158,11,.12)' },
  CLASSIC:      { color: '#a855f7', soft: 'rgba(168,85,247,.12)' },
  TEAM_GP:      { color: '#06b6d4', soft: 'rgba(6,182,212,.12)' },
  TEAM_CLASSIC: { color: '#f43f5e', soft: 'rgba(244,63,94,.12)' },
  TOURNAMENT:   { color: '#fbbf24', soft: 'rgba(251,191,36,.14)' },
};

export type MatchStatus = 'pending' | 'matchOn' | 'rated' | 'full';

export function getMatchStatus(
  current: number,
  min: number,
  rated: number,
  max: number,
): MatchStatus {
  if (current >= max) return 'full';
  if (current >= rated) return 'rated';
  if (current >= min) return 'matchOn';
  return 'pending';
}

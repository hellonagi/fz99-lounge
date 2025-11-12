// User & Auth Types
export interface User {
  id: string;
  profileId: number;
  discordId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  role: UserRole;
  status?: UserStatus;
  youtubeUrl?: string | null;
  twitchUrl?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export type UserRole = 'PLAYER' | 'MODERATOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'WARNED' | 'TEMP_BANNED' | 'PERM_BANNED' | 'DELETED';

// Game Mode Types
export type GameMode = 'GP' | 'CLASSIC' | 'TOURNAMENT';
export type League =
  | 'KNIGHT'
  | 'QUEEN'
  | 'KING'
  | 'ACE'
  | 'MIRROR_KNIGHT'
  | 'MIRROR_QUEEN'
  | 'MIRROR_KING'
  | 'MIRROR_ACE'
  | 'CLASSIC_MINI';

// Lobby Types
export interface Lobby {
  id: string;
  gameMode: GameMode;
  leagueType: League | null;
  status: LobbyStatus;
  currentPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  scheduledStart: string;
  countdownStart?: string | null;
  actualStart?: string | null;
}

export type LobbyStatus =
  | 'WAITING'
  | 'READY'
  | 'FULL'
  | 'STARTING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

// Match Types
export interface Match {
  id: string;
  gameMode: GameMode;
  leagueType: League;
  status: MatchStatus;
  totalPlayers: number;
  startedAt: string;
  completedAt?: string | null;
}

export type MatchStatus =
  | 'ONGOING'
  | 'RESULTS_PENDING'
  | 'PROVISIONALLY_CONFIRMED'
  | 'COMPLETED'
  | 'ABORTED';

// User Stats Types
export interface UserStats99 {
  mmr: number;
  seasonHighMmr: number;
  totalMatches: number;
  totalWins: number;
  top3Finishes: number;
  top10Finishes: number;
  averagePosition: number;
  totalKos: number;
  bestPosition: number;
  currentStreak: number;
  favoriteMachine?: string | null;
}

export interface UserStatsClassic {
  mmr: number;
  seasonHighMmr: number;
  totalMatches: number;
  totalWins: number;
  top3Finishes: number;
  averagePosition: number;
  bestPosition: number;
  currentStreak: number;
  favoriteMachine?: string | null;
}

// API Response Types
export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface UserProfileResponse extends User {
  stats99?: UserStats99;
  statsClassic?: UserStatsClassic;
}

// User & Auth Types
export interface User {
  id: number;
  discordId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  role: UserRole;
  status?: UserStatus;
  country?: string | null;
  youtubeUrl?: string | null;
  twitchUrl?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export type UserRole = 'PLAYER' | 'MODERATOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'WARNED' | 'SUSPENDED' | 'BANNED' | 'DELETED';

// Event Category - システムレベルの分類（レート計算ロジック）
export type EventCategory = 'GP' | 'CLASSIC' | 'TOURNAMENT';

// In-Game Mode - F-Zero 99 のゲーム内モード
export type InGameMode =
  | 'GRAND_PRIX'
  | 'MINI_PRIX'
  | 'TEAM_BATTLE'
  | 'CLASSIC_MINI_PRIX'
  | 'PRO'
  | 'CLASSIC'
  | 'NINETY_NINE';

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

// Match Types (was Lobby - waiting room for a session)
export interface Match {
  id: number;
  seasonId: number;
  matchNumber: number;
  status: MatchStatus;
  minPlayers: number;
  maxPlayers: number;
  scheduledStart: string;
  actualStart?: string | null;
  deadline: string;  // スコア提出期限
  notes?: string | null;
  createdAt: string;
  // Computed
  currentPlayers?: number;
  // Relations
  season?: Season;
  participants?: MatchParticipant[];
}

export type MatchStatus =
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FINALIZED'
  | 'CANCELLED';

export interface MatchParticipant {
  id: number;
  matchId: number;
  userId: number;
  joinedAt: string;
  hasWithdrawn: boolean;
  withdrawnAt?: string | null;
  // Relations
  user?: User;
  streams?: MatchStream[];
}

// Game Types (was Match - actual game within a session)
export interface Game {
  id: number;
  matchId: number;
  gameNumber: number;
  inGameMode: InGameMode;
  leagueType: League;
  passcode: string;
  passcodePublishedAt?: string | null;
  startedAt?: string | null;
  tracks?: number[] | null; // CLASSIC用: 各レースのコースID [R1, R2, R3]
  // Relations
  match?: Match;
  participants?: GameParticipant[];
}

export interface GameParticipant {
  id: number;
  gameId: number;
  userId: number;
  machine: string;
  assistEnabled: boolean;
  status: ResultStatus;
  // Relations
  user?: User;
  raceResults?: RaceResult[];
}

export interface MatchStream {
  id: number;
  matchParticipantId: number;
  platform: 'YOUTUBE' | 'TWITCH';
  streamUrl: string;
  isLive: boolean;
  thumbnailUrl?: string | null;
  viewerCount?: number | null;
  streamTitle?: string | null;
  // Relations
  matchParticipant?: MatchParticipant;
}

export interface RaceResult {
  id: number;
  gameParticipantId: number;
  raceNumber: number;  // 1-5 (GRAND_PRIX) or 1 (単発モード)
  position?: number | null;
  points?: number | null;
  isEliminated: boolean;  // クラッシュアウト/ランクアウトで脱落
}

export type ResultStatus =
  | 'UNSUBMITTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DISPUTED'
  | 'INVALIDATED';

// Event & Season Types
export interface Event {
  id: number;
  category: EventCategory;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  id: number;
  eventId: number;
  seasonNumber: number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  description?: string | null;
  // Relations
  event?: Event;
}

// User Season Stats (シーズン別統計)
export interface UserSeasonStats {
  id: number;
  userId: number;
  seasonId: number;
  // レート
  internalRating: number;
  displayRating: number;
  convergencePoints: number;
  seasonHighRating: number;
  // 統計
  totalMatches: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  survivedCount: number;
  assistUsedCount: number;
  // リーダーボード順位
  leaderboardRank?: number;
  // Relations
  season?: Season;
}

// API Response Types
export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface UserProfileResponse extends User {
  seasonStats?: UserSeasonStats[];
}

// ユーザー試合履歴
export interface UserMatchHistoryEntry {
  matchId: number;
  matchNumber: number;
  category: EventCategory;
  seasonNumber: number;
  completedAt: string;
  position: number;
  totalParticipants: number;
  totalScore: number | null;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
}

// ユーザーレーティング履歴
export interface UserRatingHistoryEntry {
  matchId: number;
  matchNumber: number;
  displayRating: number;
  internalRating: number;
  createdAt: string;
}

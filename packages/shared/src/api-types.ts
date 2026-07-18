// API レスポンスの型定義（旧 apps/web/types/index.ts から移設）。
// enum は enums.ts（Prisma と同期）を参照する。日時は JSON 経由のため string。

import type {
  UserRole,
  UserStatus,
  ModeratorPermission,
  EventCategory,
  InGameMode,
  League,
  MatchStatus,
  ResultStatus,
  StreamPlatform,
  TournamentStatus,
  TournamentDivision,
  TournamentMode,
} from './enums';

// User & Auth Types
export interface Profile {
  id?: number;
  userId?: number;
  country: string | null; // ISO 3166-1 alpha-2 (JP, US, etc.)
}

export interface User {
  id: number;
  profileNumber: number;
  discordId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  role: UserRole;
  status?: UserStatus;
  country?: string | null; // 一部APIはprofile.countryをフラット化して返す
  youtubeUrl?: string | null;
  twitchUrl?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  permissions?: ModeratorPermission[];
  // Relations
  profile?: Profile | null;
}

// Match Types (was Lobby - waiting room for a session)
export interface Match {
  id: number;
  seasonId: number;
  matchNumber: number | null;
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
  games?: Game[];
}

export interface MatchParticipant {
  id: number;
  matchId: number;
  userId: number;
  joinedAt: string;
  hasWithdrawn: boolean;
  withdrawnAt?: string | null;
  totalPoints?: number;
  finalRank?: number | null;
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
  leagueType?: League | null;
  // ADMIN/MODERATORへのレスポンスにのみ含まれる(一般には返さない)
  passcode?: string;
  passcodePublishedAt?: string | null;
  passcodeVersion?: number;
  passcodeRevealTime?: string | null;
  splitNotified?: boolean;
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
  totalScore?: number | null;
  eliminatedAtRace?: number | null;
  isCompensated?: boolean;
  isDisqualified?: boolean;
  submittedAt?: string | null;
  // Relations
  user?: User;
  raceResults?: RaceResult[];
}

export interface MatchStream {
  id: number;
  matchParticipantId: number;
  platform: StreamPlatform;
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
  isDisconnected?: boolean;  // 切断(DC)
}

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
  mvpCount: number;
  bestPosition?: number | null;
  // リーダーボード順位
  leaderboardRank?: number;
  // Relations
  season?: Season;
}

// Recurring Match Rule
export interface RecurringMatchRule {
  id: number;
  recurringMatchId: number;
  daysOfWeek: number[];
  timeOfDay: string; // "HH:mm" JST
  lastScheduledAt: string | null;
}

// Recurring Match Schedule
export interface RecurringMatch {
  id: number;
  eventCategory: EventCategory;
  inGameMode: InGameMode;
  leagueType: League | null;
  minPlayers: number;
  maxPlayers: number;
  isEnabled: boolean;
  name: string | null;
  notes: string | null;
  createdBy: number | null;
  createdByUser?: {
    id: number;
    displayName: string | null;
    username: string;
  };
  rules: RecurringMatchRule[];
  createdAt: string;
  updatedAt: string;
}

// Tournament Types
export interface TournamentRoundConfig {
  roundNumber: number;
  inGameMode: InGameMode;
  league?: League;
  offsetMinutes?: number;
}

export interface LocalizedContent {
  en: string;
  ja: string;
}

export type ScheduleEventType = 'OPEN' | 'INTERVAL' | 'RESULTS' | 'END';

export interface TournamentScheduleEvent {
  offsetMinutes: number;
  label: LocalizedContent;
  type?: ScheduleEventType;
}

export interface Tournament {
  id: number;
  seasonId: number;
  name: string;
  tournamentNumber: number;
  status: TournamentStatus;
  rounds: TournamentRoundConfig[];
  totalRounds: number;
  tournamentDate: string;
  registrationStart: string;
  registrationEnd: string;
  minPlayers: number;
  maxPlayers: number;
  registrationCount: number;
  content?: LocalizedContent | null;
  scheduleEvents?: TournamentScheduleEvent[] | null;
  venue?: string | null;
  venueUrl?: string | null;
  season?: Season & { matches?: Match[] };
  // 部門別のパスコード公開チャンネルURL(専用チャンネル未設定時は共通チャンネルへのURL)
  discordPasscodeChannelUrls?: Record<TournamentDivision, string | null> | null;
}

export interface TournamentStream {
  id: number;
  tournamentConfigId: number;
  platform: StreamPlatform;
  channelIdentifier: string;
  label: string;
  sortOrder: number;
  isFeatured: boolean;
}

export interface RecentTournament {
  id: number;
  name: string;
  tournamentNumber: number;
  status: TournamentStatus;
  tournamentDate: string;
  totalRounds: number;
  participantCount: number;
  winner: {
    id: number;
    displayName: string | null;
    totalScore: number;
  } | null;
  winners?: Array<{
    id: number;
    displayName: string | null;
    totalScore: number;
  }>;
  topScorers?: Array<{
    rank: number;
    id: number;
    displayName: string | null;
    totalScore: number;
  }>;
}

export interface TournamentRegistration {
  id: number;
  userId: number;
  tournamentConfigId: number;
  registeredAt: string;
  division: TournamentDivision;
  mode: TournamentMode | null;
  prizeEntry: boolean;
  user?: User;
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
  // GP/TEAM_GP modes only
  position?: number;
  totalParticipants?: number;
}

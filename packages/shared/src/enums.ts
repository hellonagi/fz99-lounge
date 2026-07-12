// apps/api/prisma/schema.prisma の enum を const object + 同名 union 型で複製する。
// Prisma クライアントの enum emit と同形のため、API 側の
// apps/api/src/common/shared-type-assertions.ts で 1:1 の型同値チェックができる。
// schema.prisma の enum を変更したら、このファイルにも同じ変更を入れること。

export const UserRole = {
  PLAYER: 'PLAYER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  WARNED: 'WARNED',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const EventCategory = {
  GP: 'GP',
  CLASSIC: 'CLASSIC',
  TEAM_CLASSIC: 'TEAM_CLASSIC',
  TEAM_GP: 'TEAM_GP',
  TOURNAMENT: 'TOURNAMENT',
} as const;
export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

export const InGameMode = {
  GRAND_PRIX: 'GRAND_PRIX',
  MIRROR_GRAND_PRIX: 'MIRROR_GRAND_PRIX',
  MINI_PRIX: 'MINI_PRIX',
  TEAM_BATTLE: 'TEAM_BATTLE',
  CLASSIC_MINI_PRIX: 'CLASSIC_MINI_PRIX',
  PRO: 'PRO',
  CLASSIC: 'CLASSIC',
  NINETY_NINE: 'NINETY_NINE',
} as const;
export type InGameMode = (typeof InGameMode)[keyof typeof InGameMode];

export const League = {
  KNIGHT: 'KNIGHT',
  QUEEN: 'QUEEN',
  KING: 'KING',
  ACE: 'ACE',
  MIRROR_KNIGHT: 'MIRROR_KNIGHT',
  MIRROR_QUEEN: 'MIRROR_QUEEN',
  MIRROR_KING: 'MIRROR_KING',
  MIRROR_ACE: 'MIRROR_ACE',
  MYSTERY_KNIGHT: 'MYSTERY_KNIGHT',
} as const;
export type League = (typeof League)[keyof typeof League];

export const MatchStatus = {
  WAITING: 'WAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FINALIZED: 'FINALIZED',
  CANCELLED: 'CANCELLED',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const ResultStatus = {
  UNSUBMITTED: 'UNSUBMITTED',
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  NO_SHOW: 'NO_SHOW',
  DISPUTED: 'DISPUTED',
  INVALIDATED: 'INVALIDATED',
} as const;
export type ResultStatus = (typeof ResultStatus)[keyof typeof ResultStatus];

export const StreamPlatform = {
  YOUTUBE: 'YOUTUBE',
  TWITCH: 'TWITCH',
} as const;
export type StreamPlatform = (typeof StreamPlatform)[keyof typeof StreamPlatform];

export const ScreenshotType = {
  INDIVIDUAL: 'INDIVIDUAL',
  INDIVIDUAL_1: 'INDIVIDUAL_1',
  INDIVIDUAL_2: 'INDIVIDUAL_2',
  FINAL_SCORE: 'FINAL_SCORE',
  FINAL_SCORE_1: 'FINAL_SCORE_1',
  FINAL_SCORE_2: 'FINAL_SCORE_2',
} as const;
export type ScreenshotType = (typeof ScreenshotType)[keyof typeof ScreenshotType];

export const TournamentStatus = {
  DRAFT: 'DRAFT',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESULTS_PENDING: 'RESULTS_PENDING',
  COMPLETED: 'COMPLETED',
} as const;
export type TournamentStatus = (typeof TournamentStatus)[keyof typeof TournamentStatus];

export const TournamentDivision = {
  GP: 'GP',
  CLASSIC: 'CLASSIC',
} as const;
export type TournamentDivision = (typeof TournamentDivision)[keyof typeof TournamentDivision];

export const TournamentMode = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
} as const;
export type TournamentMode = (typeof TournamentMode)[keyof typeof TournamentMode];

export const ModeratorPermission = {
  CREATE_MATCH: 'CREATE_MATCH',
  DELETE_MATCH: 'DELETE_MATCH',
  CANCEL_MATCH: 'CANCEL_MATCH',
  VERIFY_SCORE: 'VERIFY_SCORE',
  REJECT_SCORE: 'REJECT_SCORE',
  EDIT_SCORE: 'EDIT_SCORE',
  VERIFY_SCREENSHOT: 'VERIFY_SCREENSHOT',
  REJECT_SCREENSHOT: 'REJECT_SCREENSHOT',
  END_MATCH: 'END_MATCH',
  REGENERATE_PASSCODE: 'REGENERATE_PASSCODE',
  UPDATE_TRACKS: 'UPDATE_TRACKS',
  VIEW_MULTI_ACCOUNTS: 'VIEW_MULTI_ACCOUNTS',
  VIEW_LOGIN_HISTORY: 'VIEW_LOGIN_HISTORY',
  RECALCULATE_RATING: 'RECALCULATE_RATING',
} as const;
export type ModeratorPermission = (typeof ModeratorPermission)[keyof typeof ModeratorPermission];

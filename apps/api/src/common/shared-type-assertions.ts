// @fz99/shared の enum が Prisma schema の enum と同値であることを型レベルで検証する。
// schema.prisma の enum を変更して packages/shared/src/enums.ts を更新し忘れると、
// このファイルの typecheck が落ちる（CI でも検出される）。
// 新しい enum を shared に追加したら、ここにもアサーションを 1 行追加すること。

import type {
  UserRole,
  UserStatus,
  EventCategory,
  InGameMode,
  League,
  MatchStatus,
  ResultStatus,
  StreamPlatform,
  ScreenshotType,
  TournamentStatus,
  TournamentDivision,
  TournamentMode,
  ModeratorPermission,
} from '@prisma/client';
import type * as Shared from '@fz99/shared';

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type AssertAllTrue<T extends true[]> = T;

export type SharedEnumAssertions = AssertAllTrue<
  [
    Equals<`${UserRole}`, Shared.UserRole>,
    Equals<`${UserStatus}`, Shared.UserStatus>,
    Equals<`${EventCategory}`, Shared.EventCategory>,
    Equals<`${InGameMode}`, Shared.InGameMode>,
    Equals<`${League}`, Shared.League>,
    Equals<`${MatchStatus}`, Shared.MatchStatus>,
    Equals<`${ResultStatus}`, Shared.ResultStatus>,
    Equals<`${StreamPlatform}`, Shared.StreamPlatform>,
    Equals<`${ScreenshotType}`, Shared.ScreenshotType>,
    Equals<`${TournamentStatus}`, Shared.TournamentStatus>,
    Equals<`${TournamentDivision}`, Shared.TournamentDivision>,
    Equals<`${TournamentMode}`, Shared.TournamentMode>,
    Equals<`${ModeratorPermission}`, Shared.ModeratorPermission>,
  ]
>;

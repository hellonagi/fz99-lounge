import { IsInt, IsEnum, IsBoolean, IsOptional, IsUUID, Min, Max } from 'class-validator';

export enum F99Machine {
  BLUE_FALCON = 'Blue Falcon',
  GOLDEN_FOX = 'Golden Fox',
  WILD_GOOSE = 'Wild Goose',
  FIRE_STINGRAY = 'Fire Stingray',
}

export class SubmitScoreDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  reportedPoints: number;  // ポイント (0-1000)

  @IsEnum(F99Machine)
  machine: F99Machine;  // F-ZERO 99のマシン

  @IsBoolean()
  assistEnabled: boolean;  // アシスト使用フラグ

  @IsOptional()
  @IsUUID()
  targetUserId?: string;  // moderator以上が他のユーザーのスコアを提出する場合に指定
}
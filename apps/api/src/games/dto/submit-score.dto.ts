import {
  IsInt,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum F99Machine {
  BLUE_FALCON = 'Blue Falcon',
  GOLDEN_FOX = 'Golden Fox',
  WILD_GOOSE = 'Wild Goose',
  FIRE_STINGRAY = 'Fire Stingray',
}

// Individual race result for CLASSIC/GP mode
export class RaceResultDto {
  @IsInt()
  @Min(1)
  @Max(5)
  raceNumber: number; // 1-3 (CLASSIC) or 1-5 (GP)

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  position?: number; // 1-20 (CLASSIC) or 1-99 (GP), null if eliminated or disconnected

  @IsBoolean()
  isEliminated: boolean; // true if ranked out or crashed out

  @IsOptional()
  @IsBoolean()
  isDisconnected?: boolean; // true if disconnected during race
}

export class SubmitScoreDto {
  // For GP mode: direct points input
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  reportedPoints?: number; // ポイント (0-1000) - GPモード用

  @IsEnum(F99Machine)
  machine: F99Machine; // F-ZERO 99のマシン

  @IsOptional()
  @IsBoolean()
  assistEnabled?: boolean; // アシスト使用フラグ（CLASSICモード用、GPモードでは不要）

  @IsOptional()
  @IsNumber()
  targetUserId?: number; // moderator以上が他のユーザーのスコアを提出する場合に指定

  // For CLASSIC mode: race-by-race results
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RaceResultDto)
  raceResults?: RaceResultDto[]; // CLASSICモード用
}

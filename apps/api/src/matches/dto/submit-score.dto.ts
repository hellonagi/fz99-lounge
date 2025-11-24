import { IsInt, IsEnum, IsBoolean, Min, Max } from 'class-validator';

export enum F99Machine {
  BLUE_FALCON = 'Blue Falcon',
  GOLDEN_FOX = 'Golden Fox',
  WILD_GOOSE = 'Wild Goose',
  FIRE_STINGRAY = 'Fire Stingray',
}

export class SubmitScoreDto {
  @IsInt()
  @Min(1)
  @Max(99)
  position: number;  // 順位 (1-99)

  @IsInt()
  @Min(0)
  @Max(1000)
  reportedPoints: number;  // ポイント (0-1000)

  @IsEnum(F99Machine)
  machine: F99Machine;  // F-ZERO 99のマシン

  @IsBoolean()
  assistEnabled: boolean;  // アシスト使用フラグ
}
import {
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Individual race result for CLASSIC/GP mode
export class RaceResultUpdateDto {
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

export class UpdateScoreDto {
  // For CLASSIC mode: race-by-race results
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RaceResultUpdateDto)
  raceResults: RaceResultUpdateDto[];
}

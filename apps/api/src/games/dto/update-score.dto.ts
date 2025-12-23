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

// Individual race result for CLASSIC mode
export class RaceResultUpdateDto {
  @IsInt()
  @Min(1)
  @Max(3)
  raceNumber: number; // 1, 2, or 3

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  position?: number; // 1-20, null if eliminated or disconnected

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

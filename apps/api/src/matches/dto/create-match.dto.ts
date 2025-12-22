import { IsEnum, IsString, IsOptional, IsInt, Min, Max, IsNumber } from 'class-validator';
import { InGameMode, League } from '@prisma/client';

export class CreateMatchDto {
  @IsNumber()
  seasonId: number; // Season ID to create match for

  @IsEnum(InGameMode)
  inGameMode: InGameMode; // F-Zero 99 in-game mode for the first game

  @IsEnum(League)
  leagueType: League; // League type for the first game

  @IsString()
  scheduledStart: string; // ISO 8601 format

  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

import { IsEnum, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { GameMode, League } from '@prisma/client';

export class CreateLobbyDto {
  @IsEnum(GameMode)
  gameMode: GameMode;

  @IsEnum(League)
  leagueType: League;

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

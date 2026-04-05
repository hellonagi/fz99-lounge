import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InGameMode, League } from '@prisma/client';

export class RoundConfigDto {
  @IsInt()
  roundNumber: number;

  @IsEnum(InGameMode)
  inGameMode: InGameMode;

  @IsOptional()
  @IsEnum(League)
  league?: League;

  @IsOptional()
  @IsInt()
  offsetMinutes?: number;
}

export class CreateTournamentDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @Max(20)
  totalRounds: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoundConfigDto)
  rounds: RoundConfigDto[];

  @IsString()
  tournamentDate: string;

  @IsString()
  registrationStart: string;

  @IsString()
  registrationEnd: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(99)
  maxPlayers?: number;

  @IsOptional()
  @IsObject()
  content?: { en: string; ja: string };
}

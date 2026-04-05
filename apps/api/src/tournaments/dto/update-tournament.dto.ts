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
import { TournamentStatus } from '@prisma/client';
import { RoundConfigDto } from './create-tournament.dto';

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  totalRounds?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoundConfigDto)
  rounds?: RoundConfigDto[];

  @IsOptional()
  @IsString()
  tournamentDate?: string;

  @IsOptional()
  @IsString()
  registrationStart?: string;

  @IsOptional()
  @IsString()
  registrationEnd?: string;

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
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsOptional()
  @IsObject()
  content?: { en: string; ja: string };
}

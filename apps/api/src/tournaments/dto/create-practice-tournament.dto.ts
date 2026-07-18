import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoundConfigDto } from './create-tournament.dto';

export class CreatePracticeTournamentDto {
  @IsOptional()
  @IsString()
  name?: string;

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
}

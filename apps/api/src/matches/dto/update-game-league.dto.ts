import { IsEnum } from 'class-validator';
import { League } from '@prisma/client';

export class UpdateGameLeagueDto {
  @IsEnum(League)
  leagueType: League;
}

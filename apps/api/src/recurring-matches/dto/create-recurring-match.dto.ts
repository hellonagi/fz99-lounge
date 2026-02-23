import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  Min,
  Max,
  ArrayMinSize,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventCategory, InGameMode, League } from '@prisma/client';

export class RecurringMatchRuleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'timeOfDay must be in HH:mm format' })
  timeOfDay: string; // "HH:mm" JST
}

export class CreateRecurringMatchDto {
  @IsEnum(EventCategory)
  eventCategory: EventCategory;

  @IsEnum(InGameMode)
  inGameMode: InGameMode;

  @IsOptional()
  @IsEnum(League)
  leagueType?: League;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  maxPlayers?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecurringMatchRuleDto)
  rules: RecurringMatchRuleDto[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

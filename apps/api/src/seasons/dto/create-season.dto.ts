import { IsEnum, IsInt, IsString, IsOptional, IsISO8601, Min } from 'class-validator';
import { EventCategory } from '@prisma/client';

export class CreateSeasonDto {
  @IsEnum(EventCategory)
  category: EventCategory;

  @IsInt()
  @Min(1)
  seasonNumber: number;

  @IsISO8601()
  startDate: string; // ISO 8601 format

  @IsOptional()
  @IsISO8601()
  endDate?: string;  // ISO 8601 format (optional)

  @IsOptional()
  @IsString()
  description?: string;
}

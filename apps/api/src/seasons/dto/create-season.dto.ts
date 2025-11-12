import { GameMode } from '@prisma/client';

export class CreateSeasonDto {
  gameMode: GameMode;
  seasonNumber: number;
  startDate: string; // ISO 8601 format
  endDate?: string;  // ISO 8601 format (optional)
  description?: string;
}

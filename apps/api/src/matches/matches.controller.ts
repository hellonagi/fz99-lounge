import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MatchesService } from './matches.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GameMode } from '@prisma/client';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getById(@Param('id') id: string, @Req() req: Request) {
    // Try to get user ID if authenticated (optional auth)
    const user = req.user as any;
    const userId = user?.id;

    return this.matchesService.getById(id, userId);
  }

  @Get(':mode/:season/:game')
  @UseGuards(OptionalJwtAuthGuard)
  async getByModeSeasonGame(
    @Param('mode') mode: string,
    @Param('season') season: string,
    @Param('game') game: string,
    @Req() req: Request,
  ) {
    // Try to get user ID if authenticated (optional auth)
    const user = req.user as any;
    const userId = user?.id;

    // Convert mode string to GameMode enum
    const gameMode = mode === 'gp' ? GameMode.GP : GameMode.CLASSIC;
    const seasonNumber = parseInt(season, 10);
    const gameNumber = parseInt(game, 10);

    return this.matchesService.getByModeSeasonGame(
      gameMode,
      seasonNumber,
      gameNumber,
      userId,
    );
  }
}

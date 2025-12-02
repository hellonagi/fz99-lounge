import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { MatchesService } from './matches.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GameMode, UserRole } from '@prisma/client';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('matches')
export class MatchesController {
  constructor(
    private matchesService: MatchesService,
    private eventEmitter: EventEmitter2,
  ) {}

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
    const gameMode = mode.toUpperCase() as GameMode;
    const seasonNumber = parseInt(season, 10);
    const gameNumber = parseInt(game, 10);

    return this.matchesService.getByModeSeasonGame(
      gameMode,
      seasonNumber,
      gameNumber,
      userId,
    );
  }

  @Post(':mode/:season/:game/score')
  @UseGuards(JwtAuthGuard)
  async submitScoreByModeSeasonGame(
    @Param('mode') mode: string,
    @Param('season') season: string,
    @Param('game') game: string,
    @Body() submitScoreDto: SubmitScoreDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const gameMode = mode.toUpperCase() as GameMode;
    const seasonNumber = parseInt(season, 10);
    const gameNumber = parseInt(game, 10);

    // Determine target user ID
    let targetUserId = user.id;

    // If targetUserId is specified in DTO, check permissions
    if (submitScoreDto.targetUserId) {
      // Only MODERATOR or ADMIN can submit scores for other users
      if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only moderators and admins can submit scores for other users');
      }
      targetUserId = submitScoreDto.targetUserId;
    }

    return this.matchesService.submitScoreByModeSeasonGame(
      gameMode,
      seasonNumber,
      gameNumber,
      targetUserId,
      submitScoreDto,
    );
  }

  @Patch(':mode/:season/:game/score/:userId')
  @UseGuards(JwtAuthGuard)
  async updateScoreByModeSeasonGame(
    @Param('mode') mode: string,
    @Param('season') season: string,
    @Param('game') game: string,
    @Param('userId') targetUserId: string,
    @Body() submitScoreDto: SubmitScoreDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const gameMode = mode.toUpperCase() as GameMode;
    const seasonNumber = parseInt(season, 10);
    const gameNumber = parseInt(game, 10);

    // Only MODERATOR or ADMIN can edit other users' scores
    if (targetUserId !== user.id) {
      if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only moderators and admins can edit other users\' scores');
      }
    }

    // Use the same service method (it handles both create and update)
    return this.matchesService.submitScoreByModeSeasonGame(
      gameMode,
      seasonNumber,
      gameNumber,
      targetUserId,
      submitScoreDto,
    );
  }

  // Test endpoint to emit WebSocket events manually (for testing only)
  @Post(':id/emit-test')
  @HttpCode(HttpStatus.OK)
  async emitTestScore(
    @Param('id') matchId: string,
    @Body() data: { participant: any },
  ) {
    // Only allow in non-production
    if (process.env.NODE_ENV === 'production') {
      return { message: 'Test endpoint disabled in production' };
    }

    // Emit the WebSocket event
    this.eventEmitter.emit('match.scoreUpdated', {
      matchId,
      participant: data.participant,
    });

    return { message: 'WebSocket event emitted', matchId };
  }
}

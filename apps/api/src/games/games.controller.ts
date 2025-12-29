import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GamesService } from './games.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventCategory, UserRole } from '@prisma/client';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('games')
export class GamesController {
  constructor(
    private gamesService: GamesService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getById(@Param('id') id: string, @Req() req: Request) {
    // Try to get user ID if authenticated (optional auth)
    const user = req.user as any;
    const userId = user?.id;

    return this.gamesService.getById(parseInt(id, 10), userId);
  }

  @Get(':category/:season/:match')
  @UseGuards(OptionalJwtAuthGuard)
  async getByEventSeasonMatch(
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('match') match: string,
    @Req() req: Request,
  ) {
    // Try to get user ID if authenticated (optional auth)
    const user = req.user as any;
    const userId = user?.id;

    // Convert category string to EventCategory enum
    const eventCategory = category.toUpperCase() as EventCategory;
    const seasonNumber = parseInt(season, 10);
    const matchNumber = parseInt(match, 10);

    return this.gamesService.getByEventSeasonMatch(
      eventCategory,
      seasonNumber,
      matchNumber,
      1, // default sequence number
      userId,
    );
  }

  @Post(':category/:season/:match/score')
  @UseGuards(JwtAuthGuard)
  async submitScoreByEventSeasonMatch(
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('match') match: string,
    @Body() submitScoreDto: SubmitScoreDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const eventCategory = category.toUpperCase() as EventCategory;
    const seasonNumber = parseInt(season, 10);
    const matchNumber = parseInt(match, 10);

    // Determine target user ID
    let targetUserId = user.id;

    // If targetUserId is specified in DTO, check permissions
    if (submitScoreDto.targetUserId) {
      // Only MODERATOR or ADMIN can submit scores for other users
      if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only moderators and admins can submit scores for other users',
        );
      }
      targetUserId = submitScoreDto.targetUserId;
    }

    return this.gamesService.submitScoreByEventSeasonMatch(
      eventCategory,
      seasonNumber,
      matchNumber,
      targetUserId,
      submitScoreDto,
    );
  }

  @Patch(':category/:season/:match/score/:userId')
  @UseGuards(JwtAuthGuard)
  async updateScoreByEventSeasonMatch(
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('match') match: string,
    @Param('userId') targetUserId: string,
    @Body() updateScoreDto: UpdateScoreDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const eventCategory = category.toUpperCase() as EventCategory;
    const seasonNumber = parseInt(season, 10);
    const matchNumber = parseInt(match, 10);
    const targetId = parseInt(targetUserId, 10);

    // Only MODERATOR or ADMIN can edit scores
    if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only moderators and admins can edit scores',
      );
    }

    return this.gamesService.updateScoreByEventSeasonMatch(
      eventCategory,
      seasonNumber,
      matchNumber,
      targetId,
      updateScoreDto,
    );
  }

  // Test endpoint to emit WebSocket events manually (for testing only)
  @Post(':id/emit-test')
  @HttpCode(HttpStatus.OK)
  async emitTestScore(
    @Param('id') gameId: string,
    @Body() data: { participant: any },
  ) {
    // Only allow in non-production
    if (process.env.NODE_ENV === 'production') {
      return { message: 'Test endpoint disabled in production' };
    }

    // Emit the WebSocket event
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId: parseInt(gameId, 10),
      participant: data.participant,
    });

    return { message: 'WebSocket event emitted', gameId };
  }

  @Post(':category/:season/:match/end')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async endMatch(
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('match') match: string,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const eventCategory = category.toUpperCase() as EventCategory;
    const seasonNumber = parseInt(season, 10);
    const matchNumber = parseInt(match, 10);

    // Only MODERATOR or ADMIN can end a match manually
    if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only moderators and admins can manually end a match',
      );
    }

    return this.gamesService.endMatch(eventCategory, seasonNumber, matchNumber);
  }

  @Patch(':category/:season/:match/tracks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateTracks(
    @Param('category') category: string,
    @Param('season') season: string,
    @Param('match') match: string,
    @Body() body: { tracks: number[] },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const eventCategory = category.toUpperCase() as EventCategory;
    const seasonNumber = parseInt(season, 10);
    const matchNumber = parseInt(match, 10);

    // Only MODERATOR or ADMIN can update tracks
    if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only moderators and admins can update tracks',
      );
    }

    return this.gamesService.updateTracks(
      eventCategory,
      seasonNumber,
      matchNumber,
      body.tracks,
    );
  }
}

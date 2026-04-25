import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateTournamentDto) {
    return this.tournamentsService.create(dto);
  }

  @Get()
  @Public()
  async findAll() {
    return this.tournamentsService.findAll();
  }

  @Get('week')
  @Public()
  async getWeek(@Query('from') from: string, @Query('to') to: string) {
    return this.tournamentsService.findByDateRange(new Date(from), new Date(to));
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(parseInt(id, 10));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateTournamentDto) {
    return this.tournamentsService.update(parseInt(id, 10), dto);
  }

  @Post(':id/start-countdown')
  @Roles(UserRole.ADMIN)
  async startCountdown(@Param('id') id: string) {
    return this.tournamentsService.startCountdown(parseInt(id, 10));
  }

  @Post(':id/hide-passcode')
  @Roles(UserRole.ADMIN)
  async hidePasscode(@Param('id') id: string) {
    return this.tournamentsService.hidePasscode(parseInt(id, 10));
  }

  @Post(':id/advance-round')
  @Roles(UserRole.ADMIN)
  async advanceRound(@Param('id') id: string) {
    return this.tournamentsService.advanceRound(parseInt(id, 10));
  }

  @Post(':id/register')
  async register(@Param('id') id: string, @Req() req: Request, @Body() body: { prizeEntry?: boolean }) {
    const user = req.user as any;
    return this.tournamentsService.register(parseInt(id, 10), user.id, body?.prizeEntry);
  }

  @Delete(':id/register')
  async cancelRegistration(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.tournamentsService.cancelRegistration(parseInt(id, 10), user.id);
  }

  @Get(':id/participants')
  @Public()
  async getParticipants(@Param('id') id: string) {
    return this.tournamentsService.getParticipants(parseInt(id, 10));
  }

  @Get(':id/streams')
  @Public()
  async getStreams(@Param('id') id: string) {
    return this.tournamentsService.getStreams(parseInt(id, 10));
  }

  @Post(':id/streams')
  @Roles(UserRole.ADMIN)
  async addStream(
    @Param('id') id: string,
    @Body() body: { platform: 'YOUTUBE' | 'TWITCH'; channelIdentifier: string; label: string },
  ) {
    return this.tournamentsService.addStream(parseInt(id, 10), body);
  }

  @Delete(':id/streams/:streamId')
  @Roles(UserRole.ADMIN)
  async removeStream(@Param('streamId') streamId: string) {
    return this.tournamentsService.removeStream(parseInt(streamId, 10));
  }

  @Patch(':id/streams/:streamId/featured')
  @Roles(UserRole.ADMIN)
  async setFeaturedStream(@Param('id') id: string, @Param('streamId') streamId: string) {
    return this.tournamentsService.setFeaturedStream(parseInt(id, 10), parseInt(streamId, 10));
  }
}

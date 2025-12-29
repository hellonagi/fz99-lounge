import { Controller, Get, Put, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request) {
    const user = req.user as any;
    return this.usersService.findById(user.id);
  }

  @Put('me/display-name')
  @UseGuards(JwtAuthGuard)
  async updateDisplayName(@Req() req: Request, @Body() body: { displayName: string }) {
    const user = req.user as any;
    return this.usersService.updateDisplayName(user.id, body.displayName);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: Request, @Body() updateProfileDto: UpdateProfileDto) {
    const user = req.user as any;
    return this.usersService.updateStreamUrls(user.id, updateProfileDto);
  }

  @Put('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: Request, @Body() updateProfileDto: UpdateProfileDto) {
    const user = req.user as any;
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Get('me/suggested-country')
  @UseGuards(JwtAuthGuard)
  async getSuggestedCountry(@Req() req: Request) {
    const user = req.user as any;
    return this.usersService.getSuggestedCountry(user.id);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('mode') mode: 'GP' | 'CLASSIC' = 'GP',
    @Query('seasonNumber') seasonNumber?: string,
    @Query('limit') limit: string = '100',
  ) {
    const parsedSeason = seasonNumber ? parseInt(seasonNumber, 10) : undefined;
    return this.usersService.getLeaderboard(mode, parsedSeason, parseInt(limit, 10));
  }

  @Get('profile/:profileId')
  async getUserByProfileId(@Param('profileId') profileId: string) {
    return this.usersService.findById(parseInt(profileId, 10));
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(parseInt(id, 10));
  }

  @Get(':id/matches')
  async getUserMatchHistory(
    @Param('id') id: string,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Query('category') category?: 'GP' | 'CLASSIC',
  ) {
    return this.usersService.getUserMatchHistory(
      parseInt(id, 10),
      parseInt(limit, 10),
      parseInt(offset, 10),
      category,
    );
  }

  @Get(':id/rating-history')
  async getUserRatingHistory(
    @Param('id') id: string,
    @Query('category') category?: 'GP' | 'CLASSIC',
  ) {
    return this.usersService.getUserRatingHistory(
      parseInt(id, 10),
      category,
    );
  }

  @Get(':id/track-stats')
  async getUserTrackStats(
    @Param('id') id: string,
    @Query('category') category?: 'GP' | 'CLASSIC',
  ) {
    return this.usersService.getUserTrackStats(
      parseInt(id, 10),
      category,
    );
  }
}

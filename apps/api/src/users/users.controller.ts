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
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('mode') mode: 'GP' | 'CLASSIC' = 'GP',
    @Query('limit') limit: string = '100',
  ) {
    return this.usersService.getLeaderboard(mode, parseInt(limit, 10));
  }

  @Get('profile/:profileId')
  async getUserByProfileId(@Param('profileId') profileId: string) {
    return this.usersService.findByProfileId(parseInt(profileId, 10));
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}

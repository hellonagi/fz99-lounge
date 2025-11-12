import { Controller, Get, Post, Delete, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LobbiesService } from './lobbies.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, GameMode, LobbyStatus } from '@prisma/client';

@Controller('lobbies')
export class LobbiesController {
  constructor(private lobbiesService: LobbiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(@Body() createLobbyDto: CreateLobbyDto, @Req() req: Request) {
    const user = req.user as any;
    return this.lobbiesService.create(createLobbyDto, user.id);
  }

  @Get()
  async getAll(
    @Query('mode') mode?: GameMode,
    @Query('status') status?: LobbyStatus,
  ) {
    return this.lobbiesService.getAll(mode, status);
  }

  @Get('next')
  async getNext(@Query('mode') mode: GameMode = GameMode.GP) {
    const lobby = await this.lobbiesService.getNext(mode);
    return { lobby };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.lobbiesService.getById(id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async join(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.lobbiesService.join(id, user.id);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.lobbiesService.leave(id, user.id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async cancel(@Param('id') id: string) {
    return this.lobbiesService.cancel(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async delete(@Param('id') id: string) {
    return this.lobbiesService.delete(id);
  }
}

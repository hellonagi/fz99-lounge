import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, EventCategory, MatchStatus } from '@prisma/client';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(@Body() createMatchDto: CreateMatchDto, @Req() req: Request) {
    const user = req.user as any;
    return this.matchesService.create(createMatchDto, user.id);
  }

  @Get()
  async getAll(
    @Query('category') category?: EventCategory,
    @Query('status') status?: MatchStatus,
  ) {
    return this.matchesService.getAll(category, status);
  }

  @Get('next')
  async getNext(@Query('category') category?: EventCategory) {
    const match = await this.matchesService.getNext(category);
    return { match };
  }

  @Get('recent')
  async getRecent(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.matchesService.getRecent(limitNum);
  }

  @Get('results')
  async getResults(
    @Query('category') category: EventCategory,
    @Query('seasonNumber') seasonNumber: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const seasonNum = parseInt(seasonNumber, 10);
    return this.matchesService.getResultsPaginated(
      category,
      seasonNum,
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.matchesService.getById(parseInt(id, 10));
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async join(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.matchesService.join(parseInt(id, 10), user.id);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.matchesService.leave(parseInt(id, 10), user.id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async cancel(@Param('id') id: string) {
    return this.matchesService.cancel(parseInt(id, 10));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async delete(@Param('id') id: string) {
    return this.matchesService.delete(parseInt(id, 10));
  }
}

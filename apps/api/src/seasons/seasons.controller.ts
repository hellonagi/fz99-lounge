import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SeasonsService } from './seasons.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, GameMode } from '@prisma/client';

@Controller('seasons')
export class SeasonsController {
  constructor(private seasonsService: SeasonsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createSeasonDto: CreateSeasonDto) {
    return this.seasonsService.create(createSeasonDto);
  }

  @Get('active')
  async getActive(@Query('mode') mode: GameMode = GameMode.GP) {
    return this.seasonsService.getActive(mode);
  }

  @Get()
  async getAll(@Query('mode') mode?: GameMode) {
    return this.seasonsService.getAll(mode);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.seasonsService.getById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateData: {
      seasonNumber?: number;
      description?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    return this.seasonsService.update(id, updateData);
  }

  @Patch(':id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async toggleStatus(
    @Param('id') id: string,
    @Body() data: { isActive: boolean }
  ) {
    return this.seasonsService.toggleStatus(id, data.isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    return this.seasonsService.delete(id);
  }
}

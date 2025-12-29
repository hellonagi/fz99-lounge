import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { TracksService } from './tracks.service';
import { League } from '@prisma/client';

@Controller('tracks')
export class TracksController {
  constructor(private tracksService: TracksService) {}

  @Get()
  async getAll(@Query('league') league?: League) {
    return this.tracksService.getAll(league);
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.tracksService.getById(id);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { League } from '@prisma/client';

@Injectable()
export class TracksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all tracks, optionally filtered by league
   */
  async getAll(league?: League) {
    return this.prisma.track.findMany({
      where: league ? { league } : undefined,
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get a single track by ID
   */
  async getById(id: number) {
    return this.prisma.track.findUnique({
      where: { id },
    });
  }
}

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { GameMode } from '@prisma/client';

@Injectable()
export class SeasonsService {
  constructor(private prisma: PrismaService) {}

  async create(createSeasonDto: CreateSeasonDto) {
    const { gameMode, seasonNumber, startDate, endDate, description } = createSeasonDto;

    // Check if season number already exists for this game mode
    const existing = await this.prisma.season.findUnique({
      where: {
        gameMode_seasonNumber: {
          gameMode,
          seasonNumber,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Season ${seasonNumber} already exists for ${gameMode}`
      );
    }

    // Deactivate other active events for the same game mode
    await this.prisma.event.updateMany({
      where: {
        type: 'SEASON',
        season: {
          gameMode,
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create season with associated event
    const season = await this.prisma.season.create({
      data: {
        gameMode,
        seasonNumber,
        description,
        event: {
          create: {
            type: 'SEASON',
            name: `Season ${seasonNumber} - ${gameMode}`,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            isActive: true,
          },
        },
      },
      include: {
        event: true,
      },
    });

    return season;
  }

  async getActive(gameMode: GameMode) {
    const season = await this.prisma.season.findFirst({
      where: {
        gameMode,
        event: {
          isActive: true,
          type: 'SEASON',
        },
      },
      include: {
        event: true,
      },
    });

    if (!season) {
      throw new NotFoundException(`No active season found for ${gameMode}`);
    }

    return season;
  }

  async getAll(gameMode?: GameMode) {
    return this.prisma.season.findMany({
      where: gameMode ? { gameMode } : undefined,
      include: {
        event: true,
      },
      orderBy: {
        seasonNumber: 'desc',
      },
    });
  }

  async getById(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: {
        event: true,
      },
    });

    if (!season) {
      throw new NotFoundException('Season not found');
    }

    return season;
  }

  async update(
    id: string,
    updateData: {
      seasonNumber?: number;
      description?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const season = await this.getById(id);

    // If changing season number, check for duplicates
    if (updateData.seasonNumber && updateData.seasonNumber !== season.seasonNumber) {
      const existing = await this.prisma.season.findUnique({
        where: {
          gameMode_seasonNumber: {
            gameMode: season.gameMode,
            seasonNumber: updateData.seasonNumber,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Season ${updateData.seasonNumber} already exists for ${season.gameMode}`
        );
      }
    }

    // Update season and event
    const updated = await this.prisma.season.update({
      where: { id },
      data: {
        ...(updateData.seasonNumber && { seasonNumber: updateData.seasonNumber }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        event: {
          update: {
            ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
            ...(updateData.endDate !== undefined && {
              endDate: updateData.endDate ? new Date(updateData.endDate) : null
            }),
            ...(updateData.seasonNumber && {
              name: `Season ${updateData.seasonNumber} - ${season.gameMode}`,
            }),
          },
        },
      },
      include: {
        event: true,
      },
    });

    return updated;
  }

  async toggleStatus(id: string, isActive: boolean) {
    const season = await this.getById(id);

    // If activating, deactivate other seasons of same game mode
    if (isActive) {
      await this.prisma.event.updateMany({
        where: {
          type: 'SEASON',
          season: {
            gameMode: season.gameMode,
          },
          isActive: true,
          id: {
            not: season.eventId,
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    // Update the target season's event status
    const updated = await this.prisma.season.update({
      where: { id },
      data: {
        event: {
          update: {
            isActive,
          },
        },
      },
      include: {
        event: true,
      },
    });

    return updated;
  }

  async delete(id: string) {
    const season = await this.getById(id);

    // Check if there are any lobbies associated with this season's event
    const lobbiesCount = await this.prisma.lobby.count({
      where: {
        eventId: season.eventId,
      },
    });

    if (lobbiesCount > 0) {
      throw new BadRequestException(
        `Cannot delete season with ${lobbiesCount} associated lobbies. Please delete or reassign the lobbies first.`
      );
    }

    // Delete the season (event will be cascade deleted)
    await this.prisma.season.delete({
      where: { id },
    });

    return { message: 'Season deleted successfully' };
  }
}

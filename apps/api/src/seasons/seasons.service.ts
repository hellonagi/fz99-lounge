import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { EventCategory } from '@prisma/client';

@Injectable()
export class SeasonsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new season for a given category.
   * If an Event for this category doesn't exist, it will be created.
   */
  async create(createSeasonDto: CreateSeasonDto) {
    const { category, seasonNumber, startDate, endDate, description } = createSeasonDto;

    // Find or create the Event for this category
    let event = await this.prisma.event.findFirst({
      where: { category },
    });

    if (!event) {
      // Create the Event for this category
      event = await this.prisma.event.create({
        data: {
          category,
          name: category, // "GP", "CLASSIC", or "TOURNAMENT"
          description: `${category} mode seasons`,
        },
      });
    }

    // Check if season number already exists for this event
    const existing = await this.prisma.season.findUnique({
      where: {
        eventId_seasonNumber: {
          eventId: event.id,
          seasonNumber,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Season ${seasonNumber} already exists for ${category}`
      );
    }

    // Deactivate other active seasons for the same category
    await this.prisma.season.updateMany({
      where: {
        event: { category },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create the new season
    const season = await this.prisma.season.create({
      data: {
        eventId: event.id,
        seasonNumber,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
      },
      include: {
        event: true,
      },
    });

    return season;
  }

  /**
   * Get the active season for a given category
   */
  async getActive(category: EventCategory) {
    const season = await this.prisma.season.findFirst({
      where: {
        event: { category },
        isActive: true,
      },
      include: {
        event: true,
      },
    });

    if (!season) {
      throw new NotFoundException(`No active season found for ${category}`);
    }

    return season;
  }

  /**
   * Get all seasons, optionally filtered by category
   */
  async getAll(category?: EventCategory) {
    return this.prisma.season.findMany({
      where: category ? { event: { category } } : undefined,
      include: {
        event: true,
      },
      orderBy: [
        { event: { category: 'asc' } },
        { seasonNumber: 'desc' },
      ],
    });
  }

  /**
   * Get a season by ID
   */
  async getById(id: number) {
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

  /**
   * Update a season
   */
  async update(
    id: number,
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
          eventId_seasonNumber: {
            eventId: season.eventId,
            seasonNumber: updateData.seasonNumber,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Season ${updateData.seasonNumber} already exists for ${season.event.category}`
        );
      }
    }

    // Update the season
    const updated = await this.prisma.season.update({
      where: { id },
      data: {
        ...(updateData.seasonNumber && { seasonNumber: updateData.seasonNumber }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
        ...(updateData.endDate !== undefined && {
          endDate: updateData.endDate ? new Date(updateData.endDate) : null,
        }),
      },
      include: {
        event: true,
      },
    });

    return updated;
  }

  /**
   * Toggle season active status
   */
  async toggleStatus(id: number, isActive: boolean) {
    const season = await this.getById(id);

    // If activating, deactivate other seasons of the same category
    if (isActive) {
      await this.prisma.season.updateMany({
        where: {
          event: { category: season.event.category },
          isActive: true,
          id: { not: id },
        },
        data: {
          isActive: false,
        },
      });
    }

    // Update the target season's status
    const updated = await this.prisma.season.update({
      where: { id },
      data: { isActive },
      include: {
        event: true,
      },
    });

    return updated;
  }

  /**
   * Delete a season
   */
  async delete(id: number) {
    const season = await this.getById(id);

    // Check if there are any matches associated with this season
    const matchesCount = await this.prisma.match.count({
      where: { seasonId: id },
    });

    if (matchesCount > 0) {
      throw new BadRequestException(
        `Cannot delete season with ${matchesCount} associated matches. Please delete or reassign the matches first.`
      );
    }

    // Delete the season
    await this.prisma.season.delete({
      where: { id },
    });

    return { message: 'Season deleted successfully' };
  }
}

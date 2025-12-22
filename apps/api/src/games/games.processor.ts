import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Processor('games')
export class GamesProcessor {
  private readonly logger = new Logger(GamesProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  @Process('finalize-game')
  async handleFinalizeGame(job: Job<{ gameId: number }>) {
    const { gameId } = job.data;
    this.logger.log(`Processing finalize-game job for game ${gameId}`);

    try {
      // Get game with participants
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          participants: true,
          match: true,
        },
      });

      if (!game) {
        this.logger.warn(`Game ${gameId} not found`);
        return;
      }

      // Game finalization is now handled by Match.deadline
      // No need to update individual game fields
      this.logger.log(`Game ${gameId} finalization job processed`);

      return { gameId, finalized: true };
    } catch (error) {
      this.logger.error(`Failed to finalize game ${gameId}:`, error);
      throw error;
    }
  }
}

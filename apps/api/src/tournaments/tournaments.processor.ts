import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  TournamentsService,
  PasscodeRevealJobData,
} from './tournaments.service';

@Processor('tournaments')
export class TournamentsProcessor {
  private readonly logger = new Logger(TournamentsProcessor.name);

  constructor(private tournamentsService: TournamentsService) {}

  @Process('passcode-reveal')
  async handlePasscodeReveal(job: Job<PasscodeRevealJobData>) {
    this.logger.log(
      `Processing passcode-reveal job for game ${job.data.gameId}`,
    );
    await this.tournamentsService.executePasscodeReveal(job.data);
  }
}

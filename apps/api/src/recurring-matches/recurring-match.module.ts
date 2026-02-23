import { Module } from '@nestjs/common';
import { RecurringMatchController } from './recurring-match.controller';
import { RecurringMatchService } from './recurring-match.service';
import { RecurringMatchCron } from './recurring-match.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchesModule } from '../matches/matches.module';
import { SeasonsModule } from '../seasons/seasons.module';

@Module({
  imports: [PrismaModule, MatchesModule, SeasonsModule],
  controllers: [RecurringMatchController],
  providers: [RecurringMatchService, RecurringMatchCron],
  exports: [RecurringMatchService],
})
export class RecurringMatchModule {}

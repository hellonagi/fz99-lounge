import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { TournamentsProcessor } from './tournaments.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'tournaments',
    }),
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentsProcessor],
  exports: [TournamentsService],
})
export class TournamentsModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchesProcessor } from './matches.processor';
import { MatchesDeadlineService } from './matches-deadline.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    PushNotificationsModule,
    RatingModule,
    BullModule.registerQueue({
      name: 'matches',
    }),
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesProcessor, MatchesDeadlineService],
  exports: [MatchesService],
})
export class MatchesModule {}

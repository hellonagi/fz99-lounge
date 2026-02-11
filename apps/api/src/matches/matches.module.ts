import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchesProcessor } from './matches.processor';
import { MatchesDeadlineService } from './matches-deadline.service';
import { TeamConfigService } from './team-config.service';
import { TeamAssignmentService } from './team-assignment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { RatingModule } from '../rating/rating.module';
import { TracksModule } from '../tracks/tracks.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    PushNotificationsModule,
    RatingModule,
    TracksModule,
    BullModule.registerQueue({
      name: 'matches',
    }),
  ],
  controllers: [MatchesController],
  providers: [
    MatchesService,
    MatchesProcessor,
    MatchesDeadlineService,
    TeamConfigService,
    TeamAssignmentService,
  ],
  exports: [MatchesService, TeamConfigService, TeamAssignmentService],
})
export class MatchesModule {}

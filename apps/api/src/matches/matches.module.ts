import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchesProcessor } from './matches.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    PushNotificationsModule,
    BullModule.registerQueue({
      name: 'matches',
    }),
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesProcessor],
  exports: [MatchesService],
})
export class MatchesModule {}

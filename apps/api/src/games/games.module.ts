import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesProcessor } from './games.processor';
import { GamesGateway } from './games.gateway';
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
      name: 'games',
    }),
  ],
  controllers: [GamesController],
  providers: [GamesService, GamesProcessor, GamesGateway],
  exports: [GamesService],
})
export class GamesModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SeasonsModule } from './seasons/seasons.module';
import { MatchesModule } from './matches/matches.module';
import { GamesModule } from './games/games.module';
import { EventsModule } from './events/events.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { AdminModule } from './admin/admin.module';
import { ScreenshotsModule } from './screenshots/screenshots.module';
import { StorageModule } from './storage/storage.module';
import { RatingModule } from './rating/rating.module';
import { TracksModule } from './tracks/tracks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        url: configService.get('REDIS_URL') || 'redis://localhost:6379',
      }),
    }),
    PrismaModule,
    StorageModule,
    EventsModule,
    PushNotificationsModule,
    AuthModule,
    UsersModule,
    SeasonsModule,
    MatchesModule,
    GamesModule,
    ScreenshotsModule,
    AdminModule,
    RatingModule,
    TracksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SeasonsModule } from './seasons/seasons.module';
import { LobbiesModule } from './lobbies/lobbies.module';
import { MatchesModule } from './matches/matches.module';
import { EventsModule } from './events/events.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        url: configService.get('REDIS_URL') || 'redis://localhost:6379',
      }),
    }),
    PrismaModule,
    EventsModule,
    PushNotificationsModule,
    AuthModule,
    UsersModule,
    SeasonsModule,
    LobbiesModule,
    MatchesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

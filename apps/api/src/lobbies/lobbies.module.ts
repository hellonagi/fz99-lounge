import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LobbiesController } from './lobbies.controller';
import { LobbiesService } from './lobbies.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    BullModule.registerQueue({
      name: 'matches',
    }),
  ],
  controllers: [LobbiesController],
  providers: [LobbiesService],
  exports: [LobbiesService],
})
export class LobbiesModule {}

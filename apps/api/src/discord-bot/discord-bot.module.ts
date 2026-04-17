import { Module, Global } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { DailyLoungeAnnouncementCron } from './daily-lounge-announcement.cron';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [DiscordBotService, DailyLoungeAnnouncementCron],
  exports: [DiscordBotService, DailyLoungeAnnouncementCron],
})
export class DiscordBotModule {}

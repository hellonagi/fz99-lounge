import { Module } from '@nestjs/common';
import { ScreenshotsController } from './screenshots.controller';
import { ScreenshotsService } from './screenshots.service';
import { ScreenshotsCleanupService } from './screenshots-cleanup.service';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [StorageModule, PrismaModule, RatingModule],
  controllers: [ScreenshotsController],
  providers: [ScreenshotsService, ScreenshotsCleanupService],
  exports: [ScreenshotsService],
})
export class ScreenshotsModule {}

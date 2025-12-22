import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ScreenshotsCleanupService {
  private readonly logger = new Logger(ScreenshotsCleanupService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * 未選択のスクショを自動削除 (毎日深夜3時に実行)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupUnselectedScreenshots() {
    this.logger.log('Starting cleanup of unselected screenshots...');

    // 7日以上前 & 未選択 & 未削除
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const unselectedScreenshots =
      await this.prisma.gameScreenshotSubmission.findMany({
        where: {
          isSelected: false,
          deletedAt: null,
          uploadedAt: {
            lt: cutoffDate,
          },
        },
      });

    this.logger.log(
      `Found ${unselectedScreenshots.length} screenshots to delete`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const screenshot of unselectedScreenshots) {
      try {
        // S3から削除
        await this.storage.deleteFile(screenshot.imageUrl);

        // DBを更新（ソフトデリート）
        await this.prisma.gameScreenshotSubmission.update({
          where: { id: screenshot.id },
          data: { deletedAt: new Date() },
        });

        this.logger.debug(`Deleted: ${screenshot.imageUrl}`);
        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to delete ${screenshot.imageUrl}:`,
          error.message,
        );
        failCount++;
      }
    }

    this.logger.log(
      `Cleanup completed: ${successCount} deleted, ${failCount} failed`,
    );
  }
}

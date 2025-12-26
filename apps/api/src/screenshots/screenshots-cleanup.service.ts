import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ScreenshotType } from '@prisma/client';

@Injectable()
export class ScreenshotsCleanupService {
  private readonly logger = new Logger(ScreenshotsCleanupService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * 個人成績スクショを自動削除 (毎日深夜3時に実行)
   * INDIVIDUALタイプのみ削除、FINAL_SCOREは永久保存
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupUnselectedScreenshots() {
    this.logger.log('Starting cleanup of individual screenshots...');

    // 7日以上前 & INDIVIDUALタイプ & 未削除
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const screenshotsToDelete =
      await this.prisma.gameScreenshotSubmission.findMany({
        where: {
          type: ScreenshotType.INDIVIDUAL, // INDIVIDUALのみ削除対象
          deletedAt: null,
          uploadedAt: {
            lt: cutoffDate,
          },
        },
      });

    this.logger.log(
      `Found ${screenshotsToDelete.length} individual screenshots to delete`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const screenshot of screenshotsToDelete) {
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

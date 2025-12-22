import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ScreenshotsService {
  private readonly logger = new Logger(ScreenshotsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * プレイヤーがスクショを提出
   */
  async submitScreenshot(
    gameId: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    // Gameの存在確認
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    // S3/MinIOにアップロード (temp/ フォルダ)
    const imageUrl = await this.storage.uploadTempScreenshot(String(gameId), file);

    // DBに保存
    const submission = await this.prisma.gameScreenshotSubmission.create({
      data: {
        gameId,
        userId,
        imageUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    this.logger.log(
      `Screenshot submitted for game ${gameId} by user ${userId}`,
    );

    return submission;
  }

  /**
   * 試合の提出済みスクショ一覧を取得
   */
  async getSubmissions(gameId: number) {
    return await this.prisma.gameScreenshotSubmission.findMany({
      where: {
        gameId,
        deletedAt: null, // 削除されていないもののみ
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarHash: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'asc',
      },
    });
  }

  /**
   * 管理者が1枚を選んで正式採用
   */
  async selectScreenshot(submissionId: number, adminUserId: number) {
    // 提出の存在確認
    const submission =
      await this.prisma.gameScreenshotSubmission.findUnique({
        where: { id: submissionId },
      });

    if (!submission) {
      throw new NotFoundException(
        `Screenshot submission ${submissionId} not found`,
      );
    }

    // 既に採用済みの画像があるか確認
    const existingScreenshot = await this.prisma.resultScreenshot.findUnique({
      where: { gameId: submission.gameId },
    });

    // permanent/ フォルダにコピー
    const permanentUrl = await this.storage.copyToPermanent(
      submission.imageUrl,
      String(submission.gameId),
    );

    // 既存のものがあれば削除
    if (existingScreenshot) {
      await this.storage.deleteFile(existingScreenshot.imageUrl);
      await this.prisma.resultScreenshot.delete({
        where: { id: existingScreenshot.id },
      });
    }

    // ResultScreenshotに保存
    const resultScreenshot = await this.prisma.resultScreenshot.create({
      data: {
        gameId: submission.gameId,
        imageUrl: permanentUrl,
        userId: submission.userId,
        selectedBy: adminUserId,
      },
    });

    // 提出レコードを「選択済み」にマーク
    await this.prisma.gameScreenshotSubmission.update({
      where: { id: submissionId },
      data: { isSelected: true },
    });

    this.logger.log(
      `Screenshot ${submissionId} selected for game ${submission.gameId} by admin ${adminUserId}`,
    );

    return resultScreenshot;
  }

  /**
   * 試合の正式スクショを取得
   */
  async getOfficialScreenshot(gameId: number) {
    return await this.prisma.resultScreenshot.findUnique({
      where: { gameId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
        selector: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });
  }
}

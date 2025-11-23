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
    matchId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    // Matchの存在確認
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    // S3/MinIOにアップロード (temp/ フォルダ)
    const imageUrl = await this.storage.uploadTempScreenshot(matchId, file);

    // DBに保存
    const submission = await this.prisma.matchScreenshotSubmission.create({
      data: {
        matchId,
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
      `Screenshot submitted for match ${matchId} by user ${userId}`,
    );

    return submission;
  }

  /**
   * 試合の提出済みスクショ一覧を取得
   */
  async getSubmissions(matchId: string) {
    return await this.prisma.matchScreenshotSubmission.findMany({
      where: {
        matchId,
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
  async selectScreenshot(submissionId: string, adminUserId: string) {
    // 提出の存在確認
    const submission =
      await this.prisma.matchScreenshotSubmission.findUnique({
        where: { id: submissionId },
      });

    if (!submission) {
      throw new NotFoundException(
        `Screenshot submission ${submissionId} not found`,
      );
    }

    // 既に採用済みの画像があるか確認
    const existingScreenshot = await this.prisma.resultScreenshot.findUnique({
      where: { matchId: submission.matchId },
    });

    // permanent/ フォルダにコピー
    const permanentUrl = await this.storage.copyToPermanent(
      submission.imageUrl,
      submission.matchId,
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
        matchId: submission.matchId,
        imageUrl: permanentUrl,
        userId: submission.userId,
        selectedBy: adminUserId,
      },
    });

    // 提出レコードを「選択済み」にマーク
    await this.prisma.matchScreenshotSubmission.update({
      where: { id: submissionId },
      data: { isSelected: true },
    });

    this.logger.log(
      `Screenshot ${submissionId} selected for match ${submission.matchId} by admin ${adminUserId}`,
    );

    return resultScreenshot;
  }

  /**
   * 試合の正式スクショを取得
   */
  async getOfficialScreenshot(matchId: string) {
    return await this.prisma.resultScreenshot.findUnique({
      where: { matchId },
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

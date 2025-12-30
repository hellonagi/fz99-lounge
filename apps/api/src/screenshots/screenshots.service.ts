import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ClassicRatingService } from '../rating/classic-rating.service';
import { DiscordBotService } from '../discord-bot/discord-bot.service';
import { ScreenshotType } from '@prisma/client';

@Injectable()
export class ScreenshotsService {
  private readonly logger = new Logger(ScreenshotsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private classicRatingService: ClassicRatingService,
    private discordBotService: DiscordBotService,
  ) {}

  /**
   * 1位チェック（同点1位も含む）
   */
  private async checkFirstPlace(gameId: number, userId: number): Promise<boolean> {
    const participants = await this.prisma.gameParticipant.findMany({
      where: { gameId },
      orderBy: { totalScore: 'desc' },
    });

    if (participants.length === 0) return false;

    // 最高スコアを取得
    const topScore = participants.find((p) => p.totalScore !== null)?.totalScore;
    if (topScore === null || topScore === undefined) return false;

    // 同点1位全員が提出可能
    const firstPlaceUsers = participants.filter((p) => p.totalScore === topScore);
    return firstPlaceUsers.some((p) => p.userId === userId);
  }

  /**
   * プレイヤーがスクショを提出
   * type: INDIVIDUAL（個人成績）または FINAL_SCORE（全体スコア、1位のみ）
   */
  async submitScreenshot(
    gameId: number,
    userId: number,
    file: Express.Multer.File,
    type: ScreenshotType = ScreenshotType.INDIVIDUAL,
  ) {
    // Gameの存在確認
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: true,
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    // マッチが完了している場合は提出不可
    if (game.match.status === 'COMPLETED' || game.match.status === 'FINALIZED') {
      throw new ForbiddenException('Cannot submit screenshot for a completed match');
    }

    // FINAL_SCOREの場合、1位チェック + 既にverify済みがあれば提出不可
    if (type === ScreenshotType.FINAL_SCORE) {
      const isFirstPlace = await this.checkFirstPlace(gameId, userId);
      if (!isFirstPlace) {
        throw new ForbiddenException('Only 1st place can submit final score screenshot');
      }

      // 既にverify済みのFINAL_SCOREがあれば提出不可
      const verifiedFinalScore = await this.prisma.gameScreenshotSubmission.findFirst({
        where: {
          gameId,
          type: ScreenshotType.FINAL_SCORE,
          isVerified: true,
          deletedAt: null,
        },
      });
      if (verifiedFinalScore) {
        throw new ForbiddenException('Final score screenshot already verified');
      }
    }

    // 既存のスクショがあるか確認
    const existingSubmission = await this.prisma.gameScreenshotSubmission.findFirst({
      where: {
        gameId,
        userId,
        type,
        deletedAt: null,
      },
    });

    // 既存がverifyされている場合は再提出不可
    if (existingSubmission?.isVerified) {
      throw new ForbiddenException('Cannot resubmit a verified screenshot');
    }

    // 既存があれば削除して置換
    if (existingSubmission) {
      await this.storage.deleteFile(existingSubmission.imageUrl);
      await this.prisma.gameScreenshotSubmission.delete({
        where: { id: existingSubmission.id },
      });
      this.logger.log(
        `Deleted existing ${type} screenshot for game ${gameId} by user ${userId}`,
      );
    }

    // S3/MinIOにアップロード
    let imageUrl: string;
    if (type === ScreenshotType.INDIVIDUAL) {
      imageUrl = await this.storage.uploadIndividualScreenshot(
        String(gameId),
        String(userId),
        file,
      );
    } else {
      imageUrl = await this.storage.uploadFinalScoreScreenshot(String(gameId), file);
    }

    // DBに保存
    const submission = await this.prisma.gameScreenshotSubmission.create({
      data: {
        gameId,
        userId,
        imageUrl,
        type,
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
      `${type} screenshot submitted for game ${gameId} by user ${userId}`,
    );

    return submission;
  }

  /**
   * 試合の提出済みスクショ一覧を取得
   * 削除済み（S3から削除）のスクショも返す（deletedAtで判別可能）
   */
  async getSubmissions(gameId: number, type?: ScreenshotType) {
    const where: any = {
      gameId,
      // deletedAt: null を削除 - 削除済みも含めて返す
    };

    if (type) {
      where.type = type;
    }

    const submissions = await this.prisma.gameScreenshotSubmission.findMany({
      where,
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

    // 削除済みの場合はimageUrlをnullにして返す
    return submissions.map(s => ({
      ...s,
      imageUrl: s.deletedAt ? null : s.imageUrl,
      isDeleted: !!s.deletedAt,
    }));
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

  /**
   * Moderatorがスクショを承認
   */
  async verifyScreenshot(submissionId: number, moderatorId: number) {
    const submission = await this.prisma.gameScreenshotSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException(`Screenshot submission ${submissionId} not found`);
    }

    if (submission.isVerified) {
      // 既にverified済み
      return submission;
    }

    const updated = await this.prisma.gameScreenshotSubmission.update({
      where: { id: submissionId },
      data: {
        isVerified: true,
        verifiedBy: moderatorId,
        verifiedAt: new Date(),
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
      `Screenshot ${submissionId} verified by moderator ${moderatorId}`,
    );

    // FINAL_SCOREの場合、永久保存 + 他の未verifyのFINAL_SCOREを削除
    if (submission.type === ScreenshotType.FINAL_SCORE) {
      // permanent/フォルダにコピーして永久保存
      const permanentUrl = await this.storage.copyToPermanent(
        submission.imageUrl,
        String(submission.gameId),
      );

      // 既存のResultScreenshotがあれば削除
      const existingResult = await this.prisma.resultScreenshot.findUnique({
        where: { gameId: submission.gameId },
      });
      if (existingResult) {
        await this.storage.deleteFile(existingResult.imageUrl);
        await this.prisma.resultScreenshot.delete({
          where: { id: existingResult.id },
        });
      }

      // ResultScreenshotに保存
      await this.prisma.resultScreenshot.create({
        data: {
          gameId: submission.gameId,
          imageUrl: permanentUrl,
          userId: submission.userId,
          selectedBy: moderatorId,
        },
      });

      this.logger.log(
        `FINAL_SCORE screenshot ${submissionId} saved to permanent storage`,
      );

      // 他の未verifyのFINAL_SCOREを削除
      const otherFinalScores = await this.prisma.gameScreenshotSubmission.findMany({
        where: {
          gameId: submission.gameId,
          type: ScreenshotType.FINAL_SCORE,
          isVerified: false,
          deletedAt: null,
          id: { not: submissionId },
        },
      });

      for (const other of otherFinalScores) {
        await this.storage.deleteFile(other.imageUrl);
        await this.prisma.gameScreenshotSubmission.update({
          where: { id: other.id },
          data: { deletedAt: new Date() },
        });
        this.logger.log(
          `Deleted unverified FINAL_SCORE screenshot ${other.id} (verified: ${submissionId})`,
        );
      }
    }

    // 全スクショがverifiedかチェックし、条件を満たせば自動完了
    await this.checkAllVerifiedAndFinalize(submission.gameId);

    return updated;
  }

  /**
   * Moderatorがスクショを差し戻し
   */
  async rejectScreenshot(submissionId: number, moderatorId: number) {
    const submission = await this.prisma.gameScreenshotSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException(`Screenshot submission ${submissionId} not found`);
    }

    if (submission.isVerified) {
      throw new BadRequestException('Cannot reject a verified screenshot');
    }

    if (submission.isRejected) {
      // 既にreject済み
      return submission;
    }

    // rejectされたスクショはS3から削除し、deletedAtを設定
    // これにより再提出が可能になる
    await this.storage.deleteFile(submission.imageUrl);

    const updated = await this.prisma.gameScreenshotSubmission.update({
      where: { id: submissionId },
      data: {
        isRejected: true,
        rejectedBy: moderatorId,
        rejectedAt: new Date(),
        deletedAt: new Date(),
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
      `Screenshot ${submissionId} rejected by moderator ${moderatorId}`,
    );

    return updated;
  }

  /**
   * 全スクショがverifiedかチェックし、条件を満たせばマッチをFINALIZEDに変更
   * 条件: 全参加者のINDIVIDUALがverify済み + FINAL_SCOREが1つ以上verify済み
   */
  private async checkAllVerifiedAndFinalize(gameId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
      },
    });

    // IN_PROGRESSまたはCOMPLETED（deadline経過後）の場合のみFINALIZEに遷移可能
    if (!game || (game.match.status !== 'IN_PROGRESS' && game.match.status !== 'COMPLETED')) {
      return;
    }

    const totalParticipants = game.match.participants.length;

    // INDIVIDUAL: 全参加者分がverify済みか
    const verifiedIndividualCount = await this.prisma.gameScreenshotSubmission.count({
      where: {
        gameId,
        type: ScreenshotType.INDIVIDUAL,
        isVerified: true,
        deletedAt: null,
      },
    });

    // FINAL_SCORE: 1つ以上verify済みか
    const verifiedFinalScoreCount = await this.prisma.gameScreenshotSubmission.count({
      where: {
        gameId,
        type: ScreenshotType.FINAL_SCORE,
        isVerified: true,
        deletedAt: null,
      },
    });

    this.logger.log(
      `Game ${gameId}: INDIVIDUAL ${verifiedIndividualCount}/${totalParticipants}, FINAL_SCORE ${verifiedFinalScoreCount}/1`,
    );

    // 条件: 全参加者のINDIVIDUAL + FINAL_SCOREが1つ以上
    const isReadyToFinalize = verifiedIndividualCount >= totalParticipants && verifiedFinalScoreCount >= 1;

    if (isReadyToFinalize) {
      // レート計算をトリガー
      try {
        await this.classicRatingService.calculateAndUpdateRatings(gameId);
        this.logger.log(`Rating calculation completed for game ${gameId}`);
      } catch (error) {
        this.logger.error(`Failed to calculate ratings for game ${gameId}: ${error}`);
      }

      await this.prisma.match.update({
        where: { id: game.matchId },
        data: { status: 'FINALIZED' },
      });

      this.logger.log(
        `Match ${game.matchId} automatically set to FINALIZED (all screenshots verified)`,
      );

      // Delete Discord passcode channel
      try {
        await this.discordBotService.deletePasscodeChannel(gameId);
      } catch (error) {
        this.logger.error(`Failed to delete Discord channel for game ${gameId}: ${error}`);
        // Continue even if Discord fails
      }
    }
  }

  /**
   * 試合の承認進捗を取得
   */
  async getVerificationProgress(gameId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    const totalParticipants = game.match.participants.length;

    // INDIVIDUAL
    const individualSubmitted = await this.prisma.gameScreenshotSubmission.count({
      where: { gameId, type: ScreenshotType.INDIVIDUAL, deletedAt: null },
    });
    const individualVerified = await this.prisma.gameScreenshotSubmission.count({
      where: { gameId, type: ScreenshotType.INDIVIDUAL, isVerified: true, deletedAt: null },
    });

    // FINAL_SCORE
    const finalScoreSubmitted = await this.prisma.gameScreenshotSubmission.count({
      where: { gameId, type: ScreenshotType.FINAL_SCORE, deletedAt: null },
    });
    const finalScoreVerified = await this.prisma.gameScreenshotSubmission.count({
      where: { gameId, type: ScreenshotType.FINAL_SCORE, isVerified: true, deletedAt: null },
    });

    const isComplete = individualVerified >= totalParticipants && finalScoreVerified >= 1;

    return {
      individual: {
        required: totalParticipants,
        submitted: individualSubmitted,
        verified: individualVerified,
      },
      finalScore: {
        required: 1,
        submitted: finalScoreSubmitted,
        verified: finalScoreVerified,
      },
      isComplete,
    };
  }
}

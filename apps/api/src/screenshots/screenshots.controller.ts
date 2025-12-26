import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ScreenshotsService } from './screenshots.service';
import { SubmitScreenshotDto } from './dto/submit-screenshot.dto';
import { ScreenshotType } from '@prisma/client';

@Controller('screenshots')
@UseGuards(JwtAuthGuard)
export class ScreenshotsController {
  constructor(private readonly screenshotsService: ScreenshotsService) {}

  /**
   * スクショを提出 (プレイヤー用)
   * POST /api/screenshots/submit
   * type: INDIVIDUAL（個人成績）または FINAL_SCORE（全体スコア、1位のみ）
   */
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async submitScreenshot(
    @Body() dto: SubmitScreenshotDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req,
  ) {
    return await this.screenshotsService.submitScreenshot(
      dto.gameId,
      req.user.id,
      file,
      dto.type,
    );
  }

  /**
   * 試合の提出済みスクショ一覧を取得
   * GET /api/screenshots/game/:gameId/submissions?type=INDIVIDUAL
   */
  @Public()
  @Get('game/:gameId/submissions')
  async getSubmissions(
    @Param('gameId') gameId: string,
    @Query('type') type?: ScreenshotType,
  ) {
    return await this.screenshotsService.getSubmissions(
      parseInt(gameId, 10),
      type,
    );
  }

  /**
   * スクショを承認 (管理者用)
   * POST /api/screenshots/:submissionId/verify
   */
  @Post(':submissionId/verify')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  async verifyScreenshot(
    @Param('submissionId') submissionId: string,
    @Request() req,
  ) {
    return await this.screenshotsService.verifyScreenshot(
      parseInt(submissionId, 10),
      req.user.id,
    );
  }

  /**
   * スクショを差し戻し (管理者用)
   * POST /api/screenshots/:submissionId/reject
   */
  @Post(':submissionId/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  async rejectScreenshot(
    @Param('submissionId') submissionId: string,
    @Request() req,
  ) {
    return await this.screenshotsService.rejectScreenshot(
      parseInt(submissionId, 10),
      req.user.id,
    );
  }

  /**
   * 試合の承認進捗を取得
   * GET /api/screenshots/game/:gameId/progress
   */
  @Public()
  @Get('game/:gameId/progress')
  async getVerificationProgress(@Param('gameId') gameId: string) {
    return await this.screenshotsService.getVerificationProgress(
      parseInt(gameId, 10),
    );
  }

  /**
   * 試合の正式スクショを取得
   * GET /api/screenshots/game/:gameId/official
   */
  @Get('game/:gameId/official')
  async getOfficialScreenshot(@Param('gameId') gameId: string) {
    return await this.screenshotsService.getOfficialScreenshot(parseInt(gameId, 10));
  }
}

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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

@Controller('screenshots')
@UseGuards(JwtAuthGuard)
export class ScreenshotsController {
  constructor(private readonly screenshotsService: ScreenshotsService) {}

  /**
   * スクショを提出 (プレイヤー用)
   * POST /api/screenshots/submit
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
    );
  }

  /**
   * 試合の提出済みスクショ一覧を取得
   * GET /api/screenshots/game/:gameId/submissions
   */
  @Public()
  @Get('game/:gameId/submissions')
  async getSubmissions(@Param('gameId') gameId: string) {
    return await this.screenshotsService.getSubmissions(parseInt(gameId, 10));
  }

  /**
   * スクショを選択して正式採用 (管理者用)
   * POST /api/screenshots/:submissionId/select
   */
  @Post(':submissionId/select')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  async selectScreenshot(
    @Param('submissionId') submissionId: string,
    @Request() req,
  ) {
    return await this.screenshotsService.selectScreenshot(
      parseInt(submissionId, 10),
      req.user.id,
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

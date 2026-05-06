import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(@Query('newsSlug') newsSlug: string, @Req() req: Request) {
    if (!newsSlug || !/^[a-z0-9-]+$/.test(newsSlug)) {
      throw new BadRequestException('Invalid newsSlug');
    }
    const viewer = req.user as { id: number } | undefined;
    return this.commentsService.listForArticle(newsSlug, viewer?.id ?? null);
  }

  @Get('my-pilot')
  @UseGuards(JwtAuthGuard)
  async getMyPilot(@Query('newsSlug') newsSlug: string, @Req() req: Request) {
    if (!newsSlug || !/^[a-z0-9-]+$/.test(newsSlug)) {
      throw new BadRequestException('Invalid newsSlug');
    }
    const user = req.user as { id: number };
    return this.commentsService.getPilotForUser(newsSlug, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateCommentDto, @Req() req: Request) {
    const user = req.user as any;
    return this.commentsService.create(user.id, user.role, user.status, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const commentId = parseInt(id, 10);
    if (isNaN(commentId)) {
      throw new BadRequestException('Invalid comment id');
    }
    const user = req.user as any;
    await this.commentsService.softDelete(commentId, user.id, user.role);
    return { success: true };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async listAllForAdmin(@Query('limit') limit: string | undefined, @Req() req: Request) {
    const lim = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 200;
    const viewer = req.user as { id: number };
    return this.commentsService.listAllForAdmin(lim, viewer.id);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async adminRemove(@Param('id') id: string, @Req() req: Request) {
    const commentId = parseInt(id, 10);
    if (isNaN(commentId)) {
      throw new BadRequestException('Invalid comment id');
    }
    const user = req.user as any;
    await this.commentsService.softDelete(commentId, user.id, user.role);
    return { success: true };
  }
}

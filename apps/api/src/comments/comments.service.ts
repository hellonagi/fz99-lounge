import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { getAnonymousPilot } from './f-zero-pilots';

const POSTABLE_STATUSES: UserStatus[] = [UserStatus.ACTIVE, UserStatus.WARNED];
const MODERATOR_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MODERATOR];

type CommentWithUser = Prisma.NewsCommentGetPayload<{
  include: {
    user: {
      select: { id: true; displayName: true; username: true; avatarHash: true; discordId: true };
    };
  };
}>;

export type CommentDto = {
  id: number;
  newsSlug: string;
  parentId: number | null;
  body: string | null;
  isAnonymous: boolean;
  isDeleted: boolean;
  isOwn: boolean;
  createdAt: string;
  user: { id: number; displayName: string; avatarHash: string | null; discordId: string } | null;
  anonymousPilot: { name: string; nameJa: string; color: string } | null;
  revealedUser?: { id: number; displayName: string; avatarHash: string | null; discordId: string };
  replies?: CommentDto[];
};

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async listForArticle(newsSlug: string, viewerId: number | null): Promise<CommentDto[]> {
    const comments = await this.prisma.newsComment.findMany({
      where: { newsSlug },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, displayName: true, username: true, avatarHash: true, discordId: true },
        },
      },
    });

    const tops = comments.filter((c) => c.parentId === null);
    const repliesByParent = new Map<number, CommentWithUser[]>();
    for (const c of comments) {
      if (c.parentId !== null) {
        const arr = repliesByParent.get(c.parentId) ?? [];
        arr.push(c);
        repliesByParent.set(c.parentId, arr);
      }
    }

    return tops.map((top) => ({
      ...this.toPublicDto(top, viewerId),
      replies: (repliesByParent.get(top.id) ?? []).map((r) => this.toPublicDto(r, viewerId)),
    }));
  }

  getPilotForUser(newsSlug: string, userId: number): { name: string; nameJa: string; color: string } {
    const p = getAnonymousPilot(newsSlug, userId);
    return { name: p.name, nameJa: p.nameJa, color: p.color };
  }

  async listAllForAdmin(limit = 200, viewerId: number | null): Promise<CommentDto[]> {
    const comments = await this.prisma.newsComment.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, displayName: true, username: true, avatarHash: true, discordId: true },
        },
      },
    });
    return comments.map((c) => this.toAdminDto(c, viewerId));
  }

  async create(
    userId: number,
    userRole: UserRole,
    userStatus: UserStatus,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    if (!POSTABLE_STATUSES.includes(userStatus)) {
      throw new ForbiddenException('Your account cannot post comments.');
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      const parent = await this.prisma.newsComment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, parentId: true, newsSlug: true, deletedAt: true },
      });
      if (!parent) {
        throw new BadRequestException('Parent comment not found');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('Replies can only be made to top-level comments');
      }
      if (parent.newsSlug !== dto.newsSlug) {
        throw new BadRequestException('Parent comment belongs to a different article');
      }
      if (parent.deletedAt !== null) {
        throw new BadRequestException('Cannot reply to a deleted comment');
      }
    }

    const created = await this.prisma.newsComment.create({
      data: {
        newsSlug: dto.newsSlug,
        userId,
        body: dto.body,
        isAnonymous: dto.isAnonymous ?? false,
        parentId: dto.parentId ?? null,
      },
      include: {
        user: {
          select: { id: true, displayName: true, username: true, avatarHash: true, discordId: true },
        },
      },
    });

    return MODERATOR_ROLES.includes(userRole)
      ? this.toAdminDto(created, userId)
      : this.toPublicDto(created, userId);
  }

  async softDelete(commentId: number, actorId: number, actorRole: UserRole): Promise<void> {
    const comment = await this.prisma.newsComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, deletedAt: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.deletedAt !== null) {
      return;
    }
    const isOwner = comment.userId === actorId;
    const isModerator = MODERATOR_ROLES.includes(actorRole);
    if (!isOwner && !isModerator) {
      throw new ForbiddenException('You cannot delete this comment');
    }
    await this.prisma.newsComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), deletedBy: actorId },
    });
  }

  private toPublicDto(c: CommentWithUser, viewerId: number | null): CommentDto {
    const isDeleted = c.deletedAt !== null;
    return {
      id: c.id,
      newsSlug: c.newsSlug,
      parentId: c.parentId,
      body: isDeleted ? null : c.body,
      isAnonymous: c.isAnonymous,
      isDeleted,
      isOwn: viewerId !== null && c.userId === viewerId,
      createdAt: c.createdAt.toISOString(),
      user: isDeleted || c.isAnonymous
        ? null
        : {
            id: c.user.id,
            displayName: c.user.displayName ?? c.user.username,
            avatarHash: c.user.avatarHash,
            discordId: c.user.discordId,
          },
      anonymousPilot: c.isAnonymous && !isDeleted
        ? (() => {
            const p = getAnonymousPilot(c.newsSlug, c.userId);
            return { name: p.name, nameJa: p.nameJa, color: p.color };
          })()
        : null,
    };
  }

  private toAdminDto(c: CommentWithUser, viewerId: number | null): CommentDto {
    const isDeleted = c.deletedAt !== null;
    const realUser = {
      id: c.user.id,
      displayName: c.user.displayName ?? c.user.username,
      avatarHash: c.user.avatarHash,
      discordId: c.user.discordId,
    };
    return {
      id: c.id,
      newsSlug: c.newsSlug,
      parentId: c.parentId,
      body: c.body,
      isAnonymous: c.isAnonymous,
      isDeleted,
      isOwn: viewerId !== null && c.userId === viewerId,
      createdAt: c.createdAt.toISOString(),
      user: c.isAnonymous ? null : realUser,
      anonymousPilot: c.isAnonymous
        ? (() => {
            const p = getAnonymousPilot(c.newsSlug, c.userId);
            return { name: p.name, nameJa: p.nameJa, color: p.color };
          })()
        : null,
      revealedUser: c.isAnonymous ? realUser : undefined,
    };
  }
}

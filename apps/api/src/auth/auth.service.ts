import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { DiscordBotService } from '../discord-bot/discord-bot.service';

interface DiscordUser {
  discordId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  email: string | null;
}

const AVATAR_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private discordBot: DiscordBotService,
  ) {}

  async validateOrCreateUser(discordUser: DiscordUser): Promise<{ user: User; isNewUser: boolean }> {
    let user = await this.prisma.user.findUnique({
      where: { discordId: discordUser.discordId },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      // profileNumber: MAX+1 で採番、UNIQUE制約違反時はリトライ
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const [{ next }] = await this.prisma.$queryRaw<[{ next: bigint }]>`
            SELECT COALESCE(MAX("profileNumber"), 0) + 1 AS next FROM "users"
          `;
          user = await this.prisma.user.create({
            data: {
              discordId: discordUser.discordId,
              username: discordUser.username,
              displayName: null,
              avatarHash: discordUser.avatarHash,
              avatarSyncedAt: new Date(),
              email: discordUser.email,
              role: UserRole.PLAYER,
              status: UserStatus.ACTIVE,
              lastLoginAt: new Date(),
              profileNumber: Number(next),
            },
          });
          break;
        } catch (e) {
          const isUniqueViolation = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
          if (!isUniqueViolation || attempt === MAX_RETRIES - 1) {
            throw e;
          }
        }
      }
      if (!user) {
        throw new InternalServerErrorException('Failed to create user');
      }

      // UserSeasonStats is created when user first plays in a season
    } else {
      // Update last login and profile info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUser.username,
          avatarHash: discordUser.avatarHash,
          avatarSyncedAt: new Date(),
          email: discordUser.email,
          lastLoginAt: new Date(),
        },
      });
    }

    return { user, isNewUser };
  }

  generateJwtToken(user: User): string {
    const payload = {
      sub: user.id,
      discordId: user.discordId,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  async refreshAvatarIfStale(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, avatarHash: true, avatarSyncedAt: true },
    });
    if (!user) return;

    const isStale =
      !user.avatarSyncedAt ||
      Date.now() - user.avatarSyncedAt.getTime() > AVATAR_REFRESH_TTL_MS;
    if (!isStale) return;

    const latest = await this.discordBot.fetchUserAvatarHash(user.discordId);
    if (latest === undefined) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarHash: latest,
        avatarSyncedAt: new Date(),
      },
    });
    if (latest !== user.avatarHash) {
      this.logger.log(
        `Refreshed avatar for user ${userId}: ${user.avatarHash} -> ${latest}`,
      );
    }
  }

  async login(discordUser: DiscordUser) {
    const { user, isNewUser } = await this.validateOrCreateUser(discordUser);
    const accessToken = this.generateJwtToken(user);

    return {
      accessToken,
      isNewUser,
      user: {
        id: user.id,
        profileNumber: user.profileNumber,
        discordId: user.discordId,
        username: user.username,
        displayName: user.displayName,
        avatarHash: user.avatarHash,
        role: user.role,
      },
    };
  }
}

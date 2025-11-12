import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole, UserStatus } from '@prisma/client';

interface DiscordUser {
  discordId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  email: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateOrCreateUser(discordUser: DiscordUser): Promise<User> {
    let user = await this.prisma.user.findUnique({
      where: { discordId: discordUser.discordId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          discordId: discordUser.discordId,
          username: discordUser.username,
          displayName: null, // 初回はnull、モーダルで設定させる
          avatarHash: discordUser.avatarHash,
          email: discordUser.email,
          role: UserRole.PLAYER,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

      // Create initial stats for new user
      await Promise.all([
        this.prisma.userStats99.create({
          data: { userId: user.id },
        }),
        this.prisma.userStatsClassic.create({
          data: { userId: user.id },
        }),
      ]);
    } else {
      // Update last login and profile info
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUser.username,
          avatarHash: discordUser.avatarHash,
          email: discordUser.email,
          lastLoginAt: new Date(),
        },
      });
    }

    return user;
  }

  generateJwtToken(user: User): string {
    const payload = {
      sub: user.id,
      discordId: user.discordId,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  async login(discordUser: DiscordUser) {
    const user = await this.validateOrCreateUser(discordUser);
    const accessToken = this.generateJwtToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        profileId: user.profileId,
        discordId: user.discordId,
        username: user.username,
        displayName: user.displayName,
        avatarHash: user.avatarHash,
        role: user.role,
      },
    };
  }
}

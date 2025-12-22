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

  async validateOrCreateUser(discordUser: DiscordUser): Promise<{ user: User; isNewUser: boolean }> {
    let user = await this.prisma.user.findUnique({
      where: { discordId: discordUser.discordId },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
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

      // UserSeasonStats is created when user first plays in a season
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

  async login(discordUser: DiscordUser) {
    const { user, isNewUser } = await this.validateOrCreateUser(discordUser);
    const accessToken = this.generateJwtToken(user);

    return {
      accessToken,
      isNewUser,
      user: {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        displayName: user.displayName,
        avatarHash: user.avatarHash,
        role: user.role,
      },
    };
  }
}

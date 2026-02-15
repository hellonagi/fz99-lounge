import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModeratorPermission, UserRole } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getModerators() {
    const moderators = await this.prisma.user.findMany({
      where: { role: UserRole.MODERATOR },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarHash: true,
        discordId: true,
        permissions: {
          select: { permission: true },
        },
      },
      orderBy: { username: 'asc' },
    });

    return moderators.map((mod) => ({
      ...mod,
      permissions: mod.permissions.map((p) => p.permission),
    }));
  }

  async setUserPermissions(
    userId: number,
    permissions: ModeratorPermission[],
    grantedBy: number,
  ) {
    // Delete all existing permissions for the user
    await this.prisma.userPermission.deleteMany({
      where: { userId },
    });

    // Insert new permissions
    if (permissions.length > 0) {
      await this.prisma.userPermission.createMany({
        data: permissions.map((permission) => ({
          userId,
          permission,
          grantedBy,
        })),
      });
    }

    // Return updated user with permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        permissions: {
          select: { permission: true },
        },
      },
    });

    return {
      ...user,
      permissions: user?.permissions.map((p) => p.permission) || [],
    };
  }
}

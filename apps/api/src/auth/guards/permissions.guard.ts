import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModeratorPermission, UserRole } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      ModeratorPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No permissions metadata → pass through (don't break existing behavior)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // ADMIN always passes
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Only MODERATOR can have fine-grained permissions
    if (user.role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Check if the moderator has at least one of the required permissions
    const userPermissions: string[] = user.permissions || [];
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

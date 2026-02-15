import { SetMetadata } from '@nestjs/common';
import { ModeratorPermission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: ModeratorPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

import type { User, ModeratorPermission } from '@/types';

export function hasPermission(
  user: User | null,
  permission: ModeratorPermission,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MODERATOR') return false;
  return user.permissions?.includes(permission) ?? false;
}

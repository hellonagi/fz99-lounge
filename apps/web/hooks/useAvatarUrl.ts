import { useMemo } from 'react';
import { getAvatarUrl } from '@/lib/utils';

/**
 * Hook to generate Discord avatar URL from hash
 */
export function useAvatarUrl(
  discordId: string | undefined,
  avatarHash: string | null | undefined,
  size: number = 128
): string | null {
  return useMemo(() => {
    if (!discordId || !avatarHash) return null;
    return getAvatarUrl(discordId, avatarHash, size);
  }, [discordId, avatarHash, size]);
}

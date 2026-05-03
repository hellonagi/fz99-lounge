import { cn } from '@/lib/utils';

export function getDiscordAvatarUrl(discordId: string, avatarHash: string | null, size = 32): string {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=${size}`;
  }
  // Default Discord avatar
  const index = ((Number(discordId) >>> 22) % 6 + 6) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function ParticipantAvatars({
  participants,
  max = 8,
  anonymous = false,
  count,
}: {
  participants: Array<{
    userId: number;
    user: { discordId: string; displayName: string | null; avatarHash: string | null };
  }>;
  max?: number;
  anonymous?: boolean;
  count?: number;
}) {
  if (anonymous) {
    const totalCount = count ?? participants.length;
    if (totalCount === 0) return null;
    const shown = Math.min(totalCount, max);
    const remaining = totalCount - shown;

    return (
      <div className="flex items-center">
        {Array.from({ length: shown }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-[22px] w-[22px] rounded-full border-2 border-gray-700 bg-gray-800 flex items-center justify-center text-gray-500 text-[11px] font-bold leading-none',
              i > 0 && '-ml-[5px]',
            )}
          >
            ?
          </div>
        ))}
        {remaining > 0 && (
          <span className="text-[10px] text-gray-600 pl-1.5">+{remaining}</span>
        )}
      </div>
    );
  }

  if (participants.length === 0) return null;
  const shown = participants.slice(0, max);
  const remaining = participants.length - max;

  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <img
          key={p.userId}
          src={getDiscordAvatarUrl(p.user.discordId, p.user.avatarHash)}
          alt={p.user.displayName || ''}
          title={p.user.displayName || undefined}
          className={cn(
            'h-[22px] w-[22px] rounded-full border-2 border-gray-700 object-cover',
            i > 0 && '-ml-[5px]',
          )}
          onError={(e) => {
            (e.target as HTMLImageElement).src = getDiscordAvatarUrl(p.user.discordId, null);
          }}
        />
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-600 pl-1.5">+{remaining}</span>
      )}
    </div>
  );
}

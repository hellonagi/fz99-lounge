'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';

interface AwardPlayer {
  userId: number;
  discordId: string;
  displayName: string;
  avatarHash: string | null;
  country: string | null;
}

interface Award {
  category: 'mostWins' | 'mostMvps' | 'topScorer';
  player: AwardPlayer;
  value: number;
  detail?: string;
}

interface FeaturedPlayersProps {
  awards: Award[];
  loading?: boolean;
}

function PlayerAvatar({ discordId, avatarHash, displayName }: {
  discordId: string;
  avatarHash: string | null;
  displayName: string;
}) {
  const avatarUrl = useAvatarUrl(discordId, avatarHash, 64);

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={displayName}
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full"
    />
  ) : (
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-lg font-bold">
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

const categoryConfig = {
  mostWins: { color: 'text-yellow-400', border: 'border-yellow-500/30', ring: 'ring-yellow-500/20' },
  mostMvps: { color: 'text-blue-400', border: 'border-blue-500/30', ring: 'ring-blue-500/20' },
  topScorer: { color: 'text-green-400', border: 'border-green-500/30', ring: 'ring-green-500/20' },
};

function AwardCard({ award }: { award: Award }) {
  const t = useTranslations('home.featuredPlayers');
  const config = categoryConfig[award.category];

  const valueDisplay = award.category === 'topScorer'
    ? `${award.value.toLocaleString()} pts`
    : `${award.value} ${t(`units.${award.category}`)}`;

  return (
    <Card className={`border ${config.border} bg-white/5 backdrop-blur-md ring-1 ${config.ring}`}>
      <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center gap-2 sm:gap-3">
        <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${config.color}`}>
          {t(`categories.${award.category}`)}
        </span>

        <PlayerAvatar
          discordId={award.player.discordId}
          avatarHash={award.player.avatarHash}
          displayName={award.player.displayName}
        />

        <div className="min-w-0 w-full flex items-center justify-center gap-1.5">
          {award.player.country && (
            <span
              className={`fi fi-${award.player.country.toLowerCase()} shrink-0`}
              title={award.player.country}
            />
          )}
          <Link
            href={`/profile/${award.player.userId}`}
            className="text-sm sm:text-base font-semibold text-white hover:text-blue-400 transition-colors truncate"
          >
            {award.player.displayName}
          </Link>
        </div>

        <div className="text-xs sm:text-sm text-muted-foreground">
          <span className="font-semibold text-white text-base sm:text-lg">{valueDisplay}</span>
          {award.detail && (
            <span className="ml-1.5">({award.detail})</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FeaturedPlayers({ awards, loading }: FeaturedPlayersProps) {
  const t = useTranslations('home.featuredPlayers');

  if (loading || awards.length === 0) {
    return null;
  }

  const gridCols =
    awards.length === 1
      ? 'grid-cols-1 max-w-xs'
      : awards.length === 2
        ? 'grid-cols-2 max-w-lg'
        : 'grid-cols-3 max-w-3xl';

  return (
    <section className="pt-4 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
          {t('title')}
        </h2>

        <div className={`grid ${gridCols} gap-3 sm:gap-4 mx-auto`}>
          {awards.map((award) => (
            <AwardCard key={award.category} award={award} />
          ))}
        </div>
      </div>
    </section>
  );
}

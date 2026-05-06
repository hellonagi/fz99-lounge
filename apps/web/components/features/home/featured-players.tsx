'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';

interface AwardPlayer {
  userId: number;
  profileNumber: number;
  discordId: string;
  displayName: string;
  avatarHash: string | null;
  country: string | null;
}

interface Award {
  category: 'mostWins' | 'classicTopScorer' | 'gpTopScorer' | 'mostMvps' | 'rookie' | 'biggestRatingGain';
  player: AwardPlayer;
  value: number;
  rookieType?: 'wins' | 'mvps' | 'score';
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

const categoryBadgeClass: Record<Award['category'], string> = {
  mostWins: 'text-rose-400 border-rose-500/50',
  classicTopScorer: 'text-amber-400 border-amber-500/50',
  gpTopScorer: 'text-cyan-400 border-cyan-500/50',
  mostMvps: 'text-emerald-400 border-emerald-500/50',
  rookie: 'text-violet-400 border-violet-500/50',
  biggestRatingGain: 'text-violet-400 border-violet-500/50',
};

function AwardCard({ award }: { award: Award }) {
  const t = useTranslations('home.featuredPlayers');

  const getValueDisplay = (): { value: string; unit: string } => {
    if (award.category === 'rookie') {
      if (award.rookieType === 'wins') return { value: String(award.value), unit: t('units.mostWins') };
      if (award.rookieType === 'mvps') return { value: String(award.value), unit: t('units.mostMvps') };
      return { value: award.value.toLocaleString(), unit: 'pts' };
    }
    if (award.category === 'biggestRatingGain') {
      return { value: `+${award.value.toLocaleString()}`, unit: '' };
    }
    if (award.category === 'classicTopScorer' || award.category === 'gpTopScorer') {
      return { value: award.value.toLocaleString(), unit: 'pts' };
    }
    return { value: String(award.value), unit: t(`units.${award.category}`) };
  };
  const { value, unit } = getValueDisplay();

  return (
    <Card className="border border-white/[.07] bg-white/[.05] h-full rounded-[5px]">
      <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center gap-3">
        <span
          className={cn(
            'text-[10px] font-extrabold tracking-[.12em] uppercase px-1.5 py-0.5 border rounded-[3px] bg-black/20 whitespace-nowrap',
            categoryBadgeClass[award.category],
          )}
        >
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
            href={`/profile/${award.player.profileNumber}`}
            className="text-sm sm:text-base font-semibold text-white hover:text-blue-400 transition-colors truncate"
          >
            {award.player.displayName}
          </Link>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="font-mono tabular-nums text-lg sm:text-xl font-extrabold text-white">
            {value}
          </span>
          <span className="text-[10px] font-bold tracking-[.12em] uppercase text-gray-400">
            {unit}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeaturedPlayers({ awards, loading }: FeaturedPlayersProps) {
  const t = useTranslations('home.featuredPlayers');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || awards.length === 0) return;
    if (container.scrollWidth <= container.clientWidth) return; // desktop grid: no-op
    const middleIdx = Math.floor(awards.length / 2);
    const middle = container.children[middleIdx] as HTMLElement | undefined;
    if (!middle) return;
    container.scrollLeft = middle.offsetLeft + middle.offsetWidth / 2 - container.clientWidth / 2;
  }, [awards.length]);

  if (loading || awards.length === 0) {
    return null;
  }

  return (
    <section className="pt-4 pb-8">
      <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">
        <div className="mb-4 px-4 sm:px-0">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {t('title')}
          </h2>
        </div>

        <div
          ref={scrollRef}
          className={cn(
            'flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none',
            'lg:grid-cols-5',
          )}
        >
          {awards.map((award) => (
            <div
              key={award.category}
              className="shrink-0 w-[44%] max-w-[180px] snap-center sm:w-auto sm:max-w-none"
            >
              <AwardCard award={award} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';

interface AwardPlayer {
  userId: number;
  profileNumber: number;
  discordId: string;
  displayName: string;
  avatarHash: string | null;
  country: string | null;
}

interface Award {
  category: 'mostWins' | 'classicTopScorer' | 'gpTopScorer' | 'mostMvps' | 'rookie';
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

const cardStyle = { border: 'border-white/20', ring: 'ring-white/10' };

const labelColor: Record<Award['category'], string> = {
  mostWins: 'text-red-400',
  classicTopScorer: 'text-yellow-400',
  gpTopScorer: 'text-blue-400',
  mostMvps: 'text-green-400',
  rookie: 'text-purple-400',
};

function AwardCard({ award }: { award: Award }) {
  const t = useTranslations('home.featuredPlayers');
  const config = cardStyle;

  const getValueDisplay = () => {
    if (award.category === 'rookie') {
      if (award.rookieType === 'wins') return `${award.value} ${t('units.mostWins')}`;
      if (award.rookieType === 'mvps') return `${award.value} ${t('units.mostMvps')}`;
      return `${award.value.toLocaleString()} pts`;
    }
    if (award.category === 'classicTopScorer' || award.category === 'gpTopScorer') {
      return `${award.value.toLocaleString()} pts`;
    }
    return `${award.value} ${t(`units.${award.category}`)}`;
  };
  const valueDisplay = getValueDisplay();

  return (
    <Card className={`border ${config.border} bg-white/5 backdrop-blur-md ring-1 ${config.ring} h-full`}>
      <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center gap-2 sm:gap-3">
        <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${labelColor[award.category]}`}>
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

        <div className="text-xs sm:text-sm text-muted-foreground">
          <span className="font-semibold text-white text-base sm:text-lg">{valueDisplay}</span>
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

  return (
    <section className="pt-4 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
          {t('title')}
        </h2>

        <Swiper
          modules={[EffectCoverflow]}
          effect="coverflow"
          grabCursor
          centeredSlides
          initialSlide={2}
          coverflowEffect={{
            rotate: 0,
            stretch: 80,
            depth: 100,
            modifier: 1,
            scale: 0.9,
            slideShadows: false,
          }}
          breakpoints={{
            0: { slidesPerView: 1.4, spaceBetween: 12 },
            640: { slidesPerView: 2.5, spaceBetween: 16 },
            1024: { slidesPerView: 3.5, spaceBetween: 20 },
          }}
        >
          {awards.map((award) => (
            <SwiperSlide key={award.category}>
              <AwardCard award={award} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

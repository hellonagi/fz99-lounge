'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import { TrackScene } from '@/components/features/home/track-scene';
import { Tournament, TournamentStream } from '@/types';

function getEmbedUrl(stream: TournamentStream, parentHost: string): string {
  if (stream.platform === 'TWITCH') {
    return `https://player.twitch.tv/?channel=${stream.channelIdentifier}&parent=${parentHost}&muted=true`;
  }
  return `https://www.youtube.com/embed/${stream.channelIdentifier}?autoplay=0`;
}

interface StreamCardProps {
  stream: TournamentStream;
  parentHost: string;
}

function StreamCard({ stream, parentHost }: StreamCardProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm">
      <iframe
        src={getEmbedUrl(stream, parentHost)}
        className="w-full aspect-video"
        allowFullScreen
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}

interface TournamentHeroProps {
  tournament: Tournament;
  streams: TournamentStream[];
  locale: string;
}

export function TournamentHero({ tournament, streams, locale }: TournamentHeroProps) {
  const t = useTranslations('tournament.hero');
  const [parentHost, setParentHost] = useState('localhost');
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    setParentHost(window.location.hostname);
  }, []);

  return (
    <section className="relative min-h-[350px] md:min-h-[500px] overflow-hidden">
      <TrackScene />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">
            {tournament.name} #{tournament.tournamentNumber}
          </h1>
        </div>

        {streams.length > 0 ? (
          <div className="relative mb-8">
            {/* Left arrow */}
            <button
              type="button"
              onClick={() => swiperRef.current?.slidePrev()}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <style>{`
              .stream-swiper .swiper-slide {
                transition: transform 0.3s, opacity 0.3s;
                transform: scale(0.85);
                opacity: 0.5;
              }
              .stream-swiper .swiper-slide-active {
                transform: scale(1);
                opacity: 1;
                z-index: 2;
              }
            `}</style>
            <Swiper
              className="stream-swiper"
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
                const idx = streams.findIndex((s) => s.isFeatured);
                if (idx >= 0) swiper.slideTo(idx, 0);
              }}
              grabCursor
              centeredSlides
              breakpoints={{
                0: { slidesPerView: 1, spaceBetween: 8 },
                640: { slidesPerView: 2, spaceBetween: 12 },
                1024: { slidesPerView: 3, spaceBetween: 16 },
              }}
            >
              {streams.map((stream) => (
                <SwiperSlide key={stream.id}>
                  <StreamCard stream={stream} parentHost={parentHost} />
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Right arrow */}
            <button
              type="button"
              onClick={() => swiperRef.current?.slideNext()}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        ) : (
          <p className="text-gray-400 text-center mb-8">{t('noStreams')}</p>
        )}

        <div className="text-center">
          <Link
            href={`/${locale}/tournament/${tournament.id}`}
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-full transition-colors text-lg"
          >
            {t('goToTournament')}
          </Link>
        </div>
      </div>
    </section>
  );
}

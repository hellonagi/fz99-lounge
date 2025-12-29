'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { tracksApi, Track } from '@/lib/api';
import { LOCKED_BANNER } from '@/lib/constants/tracks';
import { cn } from '@/lib/utils';

interface TrackBannersProps {
  tracks: number[] | null | undefined;
}

const getLeagueColor = (league: string | undefined) => {
  if (!league) return 'bg-gray-600/80';
  const base = league.replace('MIRROR_', '');
  switch (base) {
    case 'KNIGHT':
      return 'bg-cyan-600/80';
    case 'QUEEN':
      return 'bg-yellow-600/80';
    case 'KING':
      return 'bg-red-600/80';
    case 'ACE':
      return 'bg-blue-600/80';
    default:
      return 'bg-gray-600/80';
  }
};

export function TrackBanners({ tracks }: TrackBannersProps) {
  const [allTracks, setAllTracks] = useState<Track[]>([]);

  useEffect(() => {
    tracksApi.getAll().then((res) => setAllTracks(res.data));
  }, []);

  const getTrackById = (id: number) => allTracks.find((t) => t.id === id);
  const getTrackBanner = (trackId: number | null | undefined) => {
    if (!trackId) return LOCKED_BANNER;
    const track = getTrackById(trackId);
    return track?.bannerPath ?? LOCKED_BANNER;
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[0, 1, 2].map((index) => {
        const trackId = tracks?.[index];
        const track = trackId ? getTrackById(trackId) : null;
        const bannerSrc = getTrackBanner(trackId);

        return (
          <div
            key={index}
            className="relative aspect-[252/64] rounded-lg overflow-hidden"
          >
            <Image
              src={bannerSrc}
              alt={track?.name || 'Not set'}
              fill
              className="object-cover object-bottom"
              sizes="(max-width: 640px) 33vw, 400px"
            />
            <div className={cn(
              "absolute bottom-0 left-0 right-0 px-2 py-1",
              getLeagueColor(track?.league)
            )}>
              <span className="text-white text-xs font-medium truncate block text-center drop-shadow-md">
                {track?.name || '???'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

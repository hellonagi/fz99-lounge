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
  const base = league.replace('MIRROR_', '').replace('MYSTERY_', '');
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

  const trackCount = tracks?.length ?? 3;
  const isGpLayout = trackCount === 5;

  const renderTrackItem = (index: number) => {
    const trackId = tracks?.[index];
    const track = trackId ? getTrackById(trackId) : null;
    const bannerSrc = getTrackBanner(trackId);

    return (
      <div key={index} className="flex flex-col">
        <div className="relative aspect-[252/64] rounded-t-lg sm:rounded-lg overflow-hidden">
          <Image
            src={bannerSrc}
            alt={track?.name || 'Not set'}
            fill
            className="object-cover object-bottom"
            sizes="(max-width: 640px) 33vw, 400px"
          />
          <div className={cn(
            "absolute bottom-0 left-0 right-0 px-2 py-1 hidden sm:block",
            getLeagueColor(track?.league)
          )}>
            <span className="text-white text-xs font-medium truncate block text-center drop-shadow-md">
              {track?.name || '???'}
            </span>
          </div>
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-b-lg sm:hidden",
          getLeagueColor(track?.league)
        )}>
          <span className="text-white text-xs font-medium truncate block text-center">
            {track?.name || '???'}
          </span>
        </div>
      </div>
    );
  };

  // GP: mobile 3+2 layout, desktop 5 columns
  if (isGpLayout) {
    return (
      <>
        {/* Desktop: 5 columns */}
        <div className="hidden sm:grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => renderTrackItem(i))}
        </div>
        {/* Mobile: 3 + 2 rows */}
        <div className="sm:hidden flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {[0, 2, 4].map((i) => renderTrackItem(i))}
          </div>
          <div className="flex justify-center gap-2">
            {[1, 3].map((i) => (
              <div key={i} className="w-[calc(33.333%-0.33rem)]">
                {renderTrackItem(i)}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {Array.from({ length: trackCount }, (_, i) => renderTrackItem(i))}
    </div>
  );
}

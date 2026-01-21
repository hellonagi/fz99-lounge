'use client';

import Image from 'next/image';

const bannerPaths = [
  '/banners/tr01_mutecity1.png',
  '/banners/tr02_bigblue.png',
  '/banners/tr03_sandocean.png',
  '/banners/tr04_deathwind1.png',
  '/banners/tr05_silence.png',
  '/banners/tr07_porttown1.png',
  '/banners/tr08_redcanyon1.png',
  '/banners/tr09_whiteland1.png',
  '/banners/tr15_firefield.png',
  '/banners/tr17_sandstorm1.png',
];

function BannerGrid({ keyPrefix }: { keyPrefix: string }) {
  return (
    <div className="grid flex-shrink-0 grid-cols-5 grid-rows-2 w-[100vw] h-full">
      {bannerPaths.map((path, index) => (
        <div key={`${keyPrefix}-${index}`} className="relative overflow-hidden">
          <Image
            src={path}
            alt=""
            fill
            className="object-cover"
            sizes="20vw"
            priority={keyPrefix === 'set1' && index < 5}
          />
        </div>
      ))}
    </div>
  );
}

export function BannerMosaic() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Scrolling banner grid */}
      <div className="absolute inset-0 opacity-30">
        <div className="flex h-full animate-banner-scroll">
          <BannerGrid keyPrefix="set1" />
          <BannerGrid keyPrefix="set2" />
        </div>
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/60 to-gray-900" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-pink-900/30" />
    </div>
  );
}

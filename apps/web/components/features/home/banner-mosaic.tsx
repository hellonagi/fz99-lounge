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
  const topRow = bannerPaths.slice(0, 5);
  const bottomRow = bannerPaths.slice(5, 10);

  return (
    <div className="flex-shrink-0 w-[165vw] md:w-[100vw] h-full flex flex-col">
      {/* Top row */}
      <div className="flex h-1/2">
        {topRow.map((path, index) => (
          <div key={`${keyPrefix}-top-${index}`} className="relative w-[33vw] md:w-[20vw] overflow-hidden">
            <Image
              src={path}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 33vw, 20vw"
              priority={keyPrefix === 'set1'}
            />
          </div>
        ))}
      </div>
      {/* Bottom row - offset by half */}
      <div className="flex h-1/2 -translate-x-[16.5vw] md:-translate-x-[10vw]">
        {bottomRow.map((path, index) => (
          <div key={`${keyPrefix}-bottom-${index}`} className="relative w-[33vw] md:w-[20vw] overflow-hidden">
            <Image
              src={path}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 33vw, 20vw"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BannerMosaic() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Scrolling banner grid */}
      <div className="absolute inset-0 opacity-40">
        <div className="flex h-full animate-banner-scroll">
          <BannerGrid keyPrefix="set1" />
          <BannerGrid keyPrefix="set2" />
        </div>
      </div>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 5px)',
        }}
      />

      {/* Pixel grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0px, transparent 1px, transparent 4px),
            repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, transparent 1px, transparent 4px)
          `,
        }}
      />

      {/* Chromatic aberration overlay */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-screen opacity-20"
        style={{ transform: 'translateX(-2px)', background: 'rgba(255,0,0,0.5)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none mix-blend-screen opacity-20"
        style={{ transform: 'translateX(2px)', background: 'rgba(0,255,255,0.5)' }}
      />

      {/* CRT vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/60 to-gray-900" />
    </div>
  );
}

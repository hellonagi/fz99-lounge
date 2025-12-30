'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Screenshot {
  id: number | string;
  imageUrl: string | null;
  uploadedAt: string;
  isDeleted?: boolean;
  user: {
    id: number | string;
    displayName: string | null;
    username: string;
    avatarHash: string | null;
  };
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
}

export function ScreenshotGallery({ screenshots }: ScreenshotGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Filter out deleted screenshots (no image to show)
  const visibleScreenshots = screenshots.filter(s => s.imageUrl);

  if (visibleScreenshots.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No screenshots available</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleScreenshots.map((screenshot) => (
          <div key={screenshot.id} className="space-y-2">
            {/* Screenshot Image - Clickable */}
            <div
              className="relative aspect-video rounded-lg overflow-hidden bg-gray-800 border border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => setSelectedImage(screenshot.imageUrl)}
            >
              <Image
                src={screenshot.imageUrl!}
                alt={`Screenshot by ${screenshot.user.displayName || screenshot.user.username}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            {/* Posted by */}
            <p className="text-sm text-gray-400 px-2">
              Posted by <span className="text-white">{screenshot.user.displayName || screenshot.user.username}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Lightbox for enlarged view */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative w-full h-full max-w-7xl max-h-[90vh]">
            <Image
              src={selectedImage}
              alt="Enlarged screenshot"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <button
            className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

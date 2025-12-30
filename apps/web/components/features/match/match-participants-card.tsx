'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getAvatarUrl } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface Participant {
  user: {
    id: number;
    profileId: number;
    discordId: string;
    displayName: string | null;
    avatarHash: string | null;
    seasonStats?: Array<{
      displayRating: number;
    }>;
  };
}

interface MatchParticipantsCardProps {
  participants: Participant[];
  embedded?: boolean;
}

const ITEMS_PER_PAGE = 20;

// Helper to get rating from participant
const getRating = (participant: Participant): number => {
  return participant.user.seasonStats?.[0]?.displayRating ?? 0;
};

export function MatchParticipantsCard({ participants, embedded = false }: MatchParticipantsCardProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const getUserAvatarUrl = (discordId: string, avatarHash: string | null, index: number) => {
    const avatarUrl = getAvatarUrl(discordId, avatarHash);
    if (avatarUrl) {
      return avatarUrl;
    }
    // Use a consistent default avatar based on index instead of random
    return `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`;
  };

  // Sort participants by rating (highest first)
  const sortedParticipants = [...participants].sort((a, b) => getRating(b) - getRating(a));

  const totalPages = Math.ceil(sortedParticipants.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentParticipants = sortedParticipants.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const content = (
    <>
      {sortedParticipants.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No participants data available</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentParticipants.map((participant, index) => {
              const rating = getRating(participant);
              return (
                <div
                  key={participant.user.id}
                  className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all duration-200 hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={getUserAvatarUrl(participant.user.discordId, participant.user.avatarHash, startIndex + index)}
                        alt={participant.user.displayName || `Player ${index + 1}`}
                        className="w-10 h-10 rounded-full border-2 border-gray-700"
                      />
                    </div>

                    {/* Name and Rating */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/profile/${participant.user.id}`}
                        className="text-white font-semibold truncate block hover:text-blue-400 hover:underline"
                      >
                        {participant.user.displayName || `Player ${participant.user.profileId}`}
                      </Link>
                    </div>

                    {/* Rating */}
                    <div className="flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {rating}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => handlePageChange(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Participants ({sortedParticipants.length})
        </h3>
        {content}
      </div>
    );
  }

  return (
    <Card showGradient>
      <CardHeader>
        <CardTitle>Participants ({sortedParticipants.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

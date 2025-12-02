'use client';

import { useState } from 'react';
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
    id: string;
    profileId: number;
    discordId: string;
    displayName: string | null;
    avatarHash: string | null;
  };
}

interface MatchParticipantsCardProps {
  participants: Participant[];
}

const ITEMS_PER_PAGE = 20;

export function MatchParticipantsCard({ participants }: MatchParticipantsCardProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const getUserAvatarUrl = (discordId: string, avatarHash: string | null, index: number) => {
    const avatarUrl = getAvatarUrl(discordId, avatarHash);
    if (avatarUrl) {
      return avatarUrl;
    }
    // Use a consistent default avatar based on index instead of random
    return `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`;
  };

  const totalPages = Math.ceil(participants.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentParticipants = participants.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Card showGradient>
      <CardHeader>
        <CardTitle>Participants ({participants.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No participants data available</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentParticipants.map((participant, index) => (
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

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">
                        {participant.user.displayName || `Player ${participant.user.profileId}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
      </CardContent>
    </Card>
  );
}

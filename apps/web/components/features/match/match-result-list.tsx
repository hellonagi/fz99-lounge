'use client';

import { useState } from 'react';
import { MatchResultRow } from './match-result-row';
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
    displayName: string | null;
    avatarHash?: string | null;
  };
  position: number | null;
  reportedPoints: number | null;
  finalPoints?: number | null;
  machine: string;
  assistEnabled: boolean;
}

interface MatchResultListProps {
  participants: Participant[];
  emptyMessage?: string;
}

const ITEMS_PER_PAGE = 20;

export function MatchResultList({
  participants,
  emptyMessage = 'No results submitted yet',
}: MatchResultListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!participants || participants.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        {emptyMessage}
      </div>
    );
  }

  // API already returns participants sorted by points (desc)
  // Just calculate positions based on the order (handle ties)
  const participantsWithPosition = participants.map((participant, index) => {
    let calculatedPosition = index + 1;

    // Handle ties - if same points as previous, use same position
    if (index > 0) {
      const currentPoints = participant.finalPoints ?? participant.reportedPoints ?? 0;
      const previousPoints = participants[index - 1].finalPoints ?? participants[index - 1].reportedPoints ?? 0;
      if (currentPoints === previousPoints) {
        // Find the position of the previous participant with same points
        calculatedPosition = (participants[index - 1] as any)._calculatedPosition;
      }
    }

    return { ...participant, _calculatedPosition: calculatedPosition };
  });

  const totalPages = Math.ceil(participantsWithPosition.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentParticipants = participantsWithPosition.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {currentParticipants.map((participant) => (
          <MatchResultRow
            key={participant.user.id}
            position={(participant as any)._calculatedPosition}
            displayName={participant.user.displayName}
            profileId={participant.user.profileId}
            machine={participant.machine}
            assistEnabled={participant.assistEnabled}
            reportedPoints={participant.reportedPoints}
          />
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
  );
}

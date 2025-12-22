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
    id: number;
    profileId: number;
    displayName: string | null;
    avatarHash?: string | null;
    profile?: { country: string | null } | null;
  };
  position: number | null;
  reportedPoints: number | null;
  finalPoints?: number | null;
  machine: string;
  assistEnabled: boolean;
  totalScore?: number | null;
  eliminatedAtRace?: number | null;
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

  // Sort participants:
  // 1. Non-DNF users by totalScore (desc)
  // 2. DNF race 3 users (all tied)
  // 3. DNF race 2 users (all tied)
  // 4. DNF race 1 users (all tied)
  const sortedParticipants = [...participants].sort((a, b) => {
    const aElim = a.eliminatedAtRace;
    const bElim = b.eliminatedAtRace;

    // Both finished (no DNF) - sort by score
    if (aElim === null && bElim === null) {
      const aScore = a.totalScore ?? a.finalPoints ?? a.reportedPoints ?? 0;
      const bScore = b.totalScore ?? b.finalPoints ?? b.reportedPoints ?? 0;
      return bScore - aScore;
    }

    // One finished, one DNF - finished player ranks higher
    if (aElim === null) return -1;
    if (bElim === null) return 1;

    // Both DNF - later race = higher rank (3 > 2 > 1)
    return bElim - aElim;
  });

  // Calculate positions with proper tie handling
  const participantsWithPosition: (Participant & { _calculatedPosition: number })[] = [];

  for (let index = 0; index < sortedParticipants.length; index++) {
    const participant = sortedParticipants[index];
    let calculatedPosition = index + 1;

    if (index > 0) {
      const currentElim = participant.eliminatedAtRace;
      const previousElim = sortedParticipants[index - 1].eliminatedAtRace;

      // DNF users at same race are tied
      if (currentElim !== null && currentElim === previousElim) {
        calculatedPosition = participantsWithPosition[index - 1]._calculatedPosition;
      }
      // Non-DNF users with same score are tied
      else if (currentElim === null && previousElim === null) {
        const currentScore = participant.totalScore ?? participant.finalPoints ?? participant.reportedPoints ?? 0;
        const previousScore = sortedParticipants[index - 1].totalScore ?? sortedParticipants[index - 1].finalPoints ?? sortedParticipants[index - 1].reportedPoints ?? 0;
        if (currentScore === previousScore) {
          calculatedPosition = participantsWithPosition[index - 1]._calculatedPosition;
        }
      }
    }

    participantsWithPosition.push({ ...participant, _calculatedPosition: calculatedPosition });
  }

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
            country={participant.user.profile?.country}
            machine={participant.machine}
            assistEnabled={participant.assistEnabled}
            totalScore={participant.totalScore}
            eliminatedAtRace={participant.eliminatedAtRace}
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

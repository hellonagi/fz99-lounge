'use client';

import { cn } from '@/lib/utils';

interface RaceResult {
  raceNumber: number;
  position: number | null;
  points: number | null;
  isEliminated: boolean;
}

interface Participant {
  user: {
    id: number;
    displayName: string | null;
  };
  machine: string;
  totalScore: number | null;
  eliminatedAtRace: number | null;
  raceResults?: RaceResult[];
  ratingAfter?: number | null;
  ratingChange?: number | null;
}

interface MatchDetailsTableProps {
  participants: Participant[];
}

export function MatchDetailsTable({ participants }: MatchDetailsTableProps) {
  if (!participants || participants.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No details available
      </div>
    );
  }

  // Sort participants same as results
  const sortedParticipants = [...participants].sort((a, b) => {
    const aElim = a.eliminatedAtRace;
    const bElim = b.eliminatedAtRace;

    if (aElim === null && bElim === null) {
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    }
    if (aElim === null) return -1;
    if (bElim === null) return 1;
    return bElim - aElim;
  });

  // Calculate positions with tie handling
  const participantsWithRank: (Participant & { rank: number })[] = [];
  for (let index = 0; index < sortedParticipants.length; index++) {
    const p = sortedParticipants[index];
    let rank = index + 1;

    if (index > 0) {
      const prev = sortedParticipants[index - 1];
      const prevRank = participantsWithRank[index - 1].rank;

      // DNF at same race = tied
      if (p.eliminatedAtRace !== null && p.eliminatedAtRace === prev.eliminatedAtRace) {
        rank = prevRank;
      }
      // Same score = tied
      else if (p.eliminatedAtRace === null && prev.eliminatedAtRace === null && p.totalScore === prev.totalScore) {
        rank = prevRank;
      }
    }

    participantsWithRank.push({ ...p, rank });
  }

  // Helper to get race position display
  const getRaceDisplay = (participant: Participant, raceNum: number) => {
    const result = participant.raceResults?.find(r => r.raceNumber === raceNum);
    if (!result) return '-';
    if (result.isEliminated) return <span className="text-red-400">DNF</span>;
    return result.position ?? '-';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="text-left py-2 px-2 font-medium">#</th>
            <th className="text-left py-2 px-2 font-medium">Player</th>
            <th className="text-left py-2 px-2 font-medium">Machine</th>
            <th className="text-center py-2 px-1 font-medium w-10">R1</th>
            <th className="text-center py-2 px-1 font-medium w-10">R2</th>
            <th className="text-center py-2 px-1 font-medium w-10">R3</th>
            <th className="text-right py-2 px-2 font-medium">Points</th>
            <th className="text-right py-2 px-2 font-medium">Rating</th>
            <th className="text-right py-2 px-2 font-medium">+/-</th>
          </tr>
        </thead>
        <tbody>
          {participantsWithRank.map((participant) => (
            <tr
              key={participant.user.id}
              className="border-b border-gray-700/50 hover:bg-gray-700/30"
            >
              {/* Rank */}
              <td className={cn(
                'py-2 px-2 font-bold',
                participant.rank <= 3 ? 'text-yellow-400' : 'text-gray-300'
              )}>
                {participant.rank}
              </td>

              {/* Player Name */}
              <td className="py-2 px-2 text-white truncate max-w-[120px]">
                {participant.user.displayName || `User#${participant.user.id}`}
              </td>

              {/* Machine */}
              <td className="py-2 px-2 text-gray-300 truncate max-w-[100px]">
                {participant.machine || '-'}
              </td>

              {/* R1 */}
              <td className="py-2 px-1 text-center text-gray-300">
                {getRaceDisplay(participant, 1)}
              </td>

              {/* R2 */}
              <td className="py-2 px-1 text-center text-gray-300">
                {getRaceDisplay(participant, 2)}
              </td>

              {/* R3 */}
              <td className="py-2 px-1 text-center text-gray-300">
                {getRaceDisplay(participant, 3)}
              </td>

              {/* Points */}
              <td className="py-2 px-2 text-right text-white font-medium">
                {participant.totalScore ?? '-'}
              </td>

              {/* Rating After */}
              <td className="py-2 px-2 text-right text-gray-300">
                {participant.ratingAfter ?? '-'}
              </td>

              {/* Rating Change */}
              <td className={cn(
                'py-2 px-2 text-right font-medium',
                participant.ratingChange == null ? 'text-gray-500' :
                participant.ratingChange > 0 ? 'text-green-400' :
                participant.ratingChange < 0 ? 'text-red-400' : 'text-gray-400'
              )}>
                {participant.ratingChange != null ? (
                  participant.ratingChange > 0 ? `+${participant.ratingChange}` : participant.ratingChange
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

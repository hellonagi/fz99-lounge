'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getMachineAbbr } from '@/lib/machines';

interface RaceResult {
  raceNumber: number;
  position: number | null;
  points: number | null;
  isEliminated: boolean;
  isDisconnected: boolean;
}

interface GameParticipant {
  user: {
    id: number;
    displayName: string | null;
    profile?: { country: string | null } | null;
  };
  machine: string;
  assistEnabled: boolean;
  totalScore: number | null;
  eliminatedAtRace: number | null;
  raceResults?: RaceResult[];
  ratingAfter?: number | null;
  ratingChange?: number | null;
  // Score verification status (UNSUBMITTED | PENDING | VERIFIED | REJECTED)
  status?: string;
}

interface MatchParticipant {
  user: {
    id: number;
    discordId: string;
    displayName: string | null;
    avatarHash: string | null;
    profile?: { country: string | null } | null;
    seasonStats?: Array<{
      displayRating: number;
    }>;
  };
}

interface Screenshot {
  id: number;
  userId: number;
  imageUrl: string | null;
  type: 'INDIVIDUAL' | 'FINAL_SCORE';
  isVerified: boolean;
  isRejected?: boolean;
  isDeleted?: boolean;
  user: {
    id: number;
    displayName: string | null;
  };
}

interface MergedParticipant {
  user: {
    id: number;
    displayName: string | null;
    profile?: { country: string | null } | null;
  };
  machine: string | null;
  assistEnabled: boolean;
  totalScore: number | null;
  eliminatedAtRace: number | null;
  raceResults?: RaceResult[];
  ratingAfter?: number | null;
  ratingChange?: number | null;
  preGameRating?: number | null;
  hasSubmitted: boolean;
  screenshot?: Screenshot;
  // Score verification status (UNSUBMITTED | PENDING | VERIFIED | REJECTED)
  status?: string;
}

interface MatchDetailsTableProps {
  gameParticipants?: GameParticipant[];
  matchParticipants?: MatchParticipant[];
  screenshots?: Screenshot[];
  isClassicMode?: boolean;
}

export function MatchDetailsTable({
  gameParticipants = [],
  matchParticipants = [],
  screenshots = [],
  isClassicMode = false,
}: MatchDetailsTableProps) {
  const t = useTranslations('screenshotStatus');

  // Merge match participants with game participants
  const mergedParticipants: MergedParticipant[] = [];

  // First, add all match participants (registered players)
  for (const mp of matchParticipants) {
    const gameData = gameParticipants.find(gp => gp.user.id === mp.user.id);
    // Find individual screenshot for this user
    const userScreenshot = screenshots.find(
      s => s.userId === mp.user.id && s.type === 'INDIVIDUAL'
    );

    mergedParticipants.push({
      user: {
        id: mp.user.id,
        displayName: mp.user.displayName,
        profile: mp.user.profile || gameData?.user.profile,
      },
      machine: gameData?.machine || null,
      assistEnabled: gameData?.assistEnabled ?? false,
      totalScore: gameData?.totalScore ?? null,
      eliminatedAtRace: gameData?.eliminatedAtRace ?? null,
      raceResults: gameData?.raceResults,
      ratingAfter: gameData?.ratingAfter ?? null,
      ratingChange: gameData?.ratingChange ?? null,
      preGameRating: mp.user.seasonStats?.[0]?.displayRating ?? null,
      hasSubmitted: !!gameData,
      screenshot: userScreenshot,
      // Score verification status
      status: gameData?.status,
    });
  }

  // Add any game participants not in match participants (edge case)
  for (const gp of gameParticipants) {
    if (!mergedParticipants.find(p => p.user.id === gp.user.id)) {
      const userScreenshot = screenshots.find(
        s => s.userId === gp.user.id && s.type === 'INDIVIDUAL'
      );
      mergedParticipants.push({
        ...gp,
        machine: gp.machine || null,
        assistEnabled: gp.assistEnabled ?? false,
        preGameRating: null,
        hasSubmitted: true,
        screenshot: userScreenshot,
        // Score verification fields (already in gp via spread)
      });
    }
  }

  if (mergedParticipants.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No participants yet
      </div>
    );
  }

  // Sort: submitted players by score first, then unsubmitted by preGameRating
  const sortedParticipants = [...mergedParticipants].sort((a, b) => {
    // Submitted players come first
    if (a.hasSubmitted && !b.hasSubmitted) return -1;
    if (!a.hasSubmitted && b.hasSubmitted) return 1;

    // Both submitted: sort by score
    if (a.hasSubmitted && b.hasSubmitted) {
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    }

    // Both not submitted: sort by preGameRating
    return (b.preGameRating ?? 0) - (a.preGameRating ?? 0);
  });

  // Calculate positions with tie handling (only for submitted players)
  const participantsWithRank: (MergedParticipant & { rank: number | null })[] = [];
  let currentRank = 0;

  for (let index = 0; index < sortedParticipants.length; index++) {
    const p = sortedParticipants[index];

    if (!p.hasSubmitted) {
      // No rank for unsubmitted players
      participantsWithRank.push({ ...p, rank: null });
      continue;
    }

    currentRank++;
    let rank = currentRank;

    // Check for ties with previous submitted player
    const prevSubmitted = participantsWithRank.filter(pp => pp.hasSubmitted);
    if (prevSubmitted.length > 0) {
      const prev = prevSubmitted[prevSubmitted.length - 1];
      if (p.totalScore === prev.totalScore && p.totalScore !== null) {
        rank = prev.rank!;
      }
    }

    participantsWithRank.push({ ...p, rank });
  }

  // Helper to get race position display
  const getRaceDisplay = (participant: MergedParticipant, raceNum: number) => {
    if (!participant.hasSubmitted) return '-';
    const result = participant.raceResults?.find(r => r.raceNumber === raceNum);
    if (!result) return '-';
    // Disconnected: show "D" in blue
    if (result.isDisconnected) {
      return <span className="text-blue-400 font-medium">D</span>;
    }
    if (result.position === null) return '-';
    // Eliminated: show position in red
    if (result.isEliminated) {
      return <span className="text-red-400">{result.position}</span>;
    }
    return result.position;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[500px] sm:min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="text-left py-2 px-2 font-medium">#</th>
            <th className="py-2 px-1 w-6"></th>
            <th className="text-left py-2 px-2 font-medium">Player</th>
            <th className="text-left py-2 px-2 font-medium w-8 sm:w-auto">
              <span className="sm:hidden">MC</span>
              <span className="hidden sm:inline">Machine</span>
            </th>
            <th className="text-center py-2 px-1 font-medium w-10">R1</th>
            <th className="text-center py-2 px-1 font-medium w-10">R2</th>
            <th className="text-center py-2 px-1 font-medium w-10">R3</th>
            <th className="text-right py-2 px-2 font-medium">Pts</th>
            <th className="text-center py-2 px-2 font-medium">Status</th>
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
                participant.rank === null ? 'text-gray-400' :
                participant.rank <= 3 ? 'text-yellow-400' : 'text-gray-100'
              )}>
                {participant.rank ?? '-'}
              </td>

              {/* Country */}
              <td className="py-2 px-1 w-6">
                <span
                  className={`fi fi-${participant.user.profile?.country?.toLowerCase() || 'un'}`}
                  title={participant.user.profile?.country || 'Unknown'}
                />
              </td>

              {/* Player Name */}
              <td className="py-2 px-2 text-white whitespace-nowrap">
                <span className="flex items-center gap-1">
                  <Link
                    href={`/profile/${participant.user.id}`}
                    className="hover:text-blue-400 hover:underline"
                  >
                    {participant.user.displayName || `User#${participant.user.id}`}
                  </Link>
                  {participant.assistEnabled && !isClassicMode && (
                    <span className="text-xs text-yellow-400 font-bold" title="Assist Mode">A</span>
                  )}
                </span>
              </td>

              {/* Machine */}
              <td className="py-2 px-2 text-gray-100 w-8 sm:w-auto">
                <span className="sm:hidden">{getMachineAbbr(participant.machine)}</span>
                <span className="hidden sm:inline">{participant.machine || '-'}</span>
              </td>

              {/* R1 */}
              <td className="py-2 px-1 text-center text-gray-100">
                {getRaceDisplay(participant, 1)}
              </td>

              {/* R2 */}
              <td className="py-2 px-1 text-center text-gray-100">
                {getRaceDisplay(participant, 2)}
              </td>

              {/* R3 */}
              <td className="py-2 px-1 text-center text-gray-100">
                {getRaceDisplay(participant, 3)}
              </td>

              {/* Points */}
              <td className="py-2 px-2 text-right font-medium text-white">
                {participant.totalScore ?? '-'}
              </td>

              {/* Status - Based on score verification */}
              <td className="py-2 px-2 text-center">
                {participant.status && participant.status !== 'UNSUBMITTED' ? (
                  <span className={cn(
                    "text-xs font-medium",
                    participant.status === 'VERIFIED'
                      ? 'text-green-400'
                      : participant.status === 'REJECTED'
                      ? 'text-red-400'
                      : 'text-blue-400'
                  )}>
                    {participant.status === 'VERIFIED'
                      ? t('ok')
                      : participant.status === 'REJECTED'
                      ? t('ng')
                      : t('pending')}
                  </span>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>

              {/* Rating After */}
              <td className="py-2 px-2 text-right text-gray-100">
                {participant.ratingAfter ?? (participant.preGameRating ?? 0)}
              </td>

              {/* Rating Change */}
              <td className={cn(
                'py-2 px-2 text-right font-medium',
                participant.ratingChange == null ? 'text-gray-400' :
                participant.ratingChange > 0 ? 'text-green-400' :
                participant.ratingChange < 0 ? 'text-red-400' : 'text-gray-300'
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

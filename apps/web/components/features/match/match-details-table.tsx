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
  // TEAM_CLASSIC fields
  teamIndex?: number | null;
  isExcluded?: boolean;
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
  type: 'INDIVIDUAL' | 'INDIVIDUAL_1' | 'INDIVIDUAL_2' | 'FINAL_SCORE' | 'FINAL_SCORE_1' | 'FINAL_SCORE_2';
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
  // TEAM_CLASSIC fields
  teamIndex?: number | null;
  isExcluded?: boolean;
}

interface TeamScore {
  teamIndex: number;
  score: number;
  rank: number;
}

interface MatchDetailsTableProps {
  gameParticipants?: GameParticipant[];
  matchParticipants?: MatchParticipant[];
  screenshots?: Screenshot[];
  isClassicMode?: boolean;
  isGpMode?: boolean;
  isTeamClassic?: boolean;
  teamScores?: TeamScore[];
  teamColors?: Record<number, string>; // teamIndex -> colorHex
  mvpUserIds?: Set<number>;
}

export function MatchDetailsTable({
  gameParticipants = [],
  matchParticipants = [],
  screenshots = [],
  isClassicMode = false,
  isGpMode = false,
  isTeamClassic = false,
  teamScores = [],
  teamColors = {},
  mvpUserIds = new Set(),
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
      // TEAM_CLASSIC fields
      teamIndex: gameData?.teamIndex ?? null,
      isExcluded: gameData?.isExcluded ?? false,
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
        // TEAM_CLASSIC fields
        teamIndex: gp.teamIndex ?? null,
        isExcluded: gp.isExcluded ?? false,
      });
    }
  }

  // Filter out excluded players (TEAM_CLASSIC)
  const activeMergedParticipants = mergedParticipants.filter(p => !p.isExcluded);

  if (activeMergedParticipants.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No participants yet
      </div>
    );
  }

  // Sort: submitted players by score first, then unsubmitted by preGameRating
  const sortedParticipants = [...activeMergedParticipants].sort((a, b) => {
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

  // Helper to render a participant row
  const renderParticipantRow = (participant: MergedParticipant & { rank: number | null }, options?: { showTeamColumn?: boolean }) => {
    const { showTeamColumn } = options || {};

    return (
    <tr
      key={participant.user.id}
      className="border-b border-gray-700/50 hover:bg-gray-700/30"
      style={showTeamColumn && participant.teamIndex != null && teamColors[participant.teamIndex]
        ? { backgroundImage: `repeating-linear-gradient(135deg, ${teamColors[participant.teamIndex]}1A, ${teamColors[participant.teamIndex]}1A 4px, transparent 4px, transparent 8px)` }
        : undefined}
    >
      {/* Rank */}
      <td className={cn(
        'py-2 px-2 font-bold',
        participant.rank === null ? 'text-gray-400' :
        participant.rank <= 3 ? 'text-yellow-400' : 'text-gray-100'
      )}>
        {participant.rank ?? '-'}
      </td>

      {/* Team */}
      {showTeamColumn && (
        <td className="py-2 px-1">
          {participant.teamIndex !== null && participant.teamIndex !== undefined ? (
            <span className="text-white">
              {String.fromCharCode(65 + participant.teamIndex)}
            </span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </td>
      )}

      {/* Player Name with Country Flag */}
      <td className="py-2 px-2 text-white whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span
            className={`fi fi-${participant.user.profile?.country?.toLowerCase() || 'un'}`}
            title={participant.user.profile?.country || 'Unknown'}
          />
          <Link
            href={`/profile/${participant.user.id}`}
            className="hover:text-blue-400 hover:underline"
          >
            {participant.user.displayName || `User#${participant.user.id}`}
          </Link>
          {participant.assistEnabled && !isClassicMode && !isGpMode && (
            <span className="text-xs text-yellow-400 font-bold" title="Assist Mode">A</span>
          )}
          {isTeamClassic && mvpUserIds.has(participant.user.id) && (
            <span className="text-xs text-amber-400 font-bold" title="MVP">MVP</span>
          )}
        </span>
      </td>

      {/* Machine */}
      <td className="py-2 px-2 text-gray-100 w-8 sm:w-auto">
        <span className="sm:hidden">{getMachineAbbr(participant.machine)}</span>
        <span className="hidden sm:inline">{participant.machine || '-'}</span>
      </td>

      {/* Race columns - dynamic based on mode */}
      {Array.from({ length: isGpMode ? 5 : 3 }, (_, i) => (
        <td key={`r${i + 1}`} className="py-2 px-1 text-center text-gray-100">
          {getRaceDisplay(participant, i + 1)}
        </td>
      ))}

      {/* Points */}
      <td className="py-2 px-2 text-right font-medium text-white">
        {participant.totalScore ?? '-'}
      </td>

      {/* Status - Based on score verification */}
      <td className="py-2 px-2 text-center whitespace-nowrap">
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

      {/* Rating After - hidden for GP */}
      {!isGpMode && (
        <td className="py-2 px-2 text-right text-gray-100">
          {participant.ratingAfter ?? (participant.preGameRating ?? 0)}
        </td>
      )}

      {/* Rating Change - hidden for GP */}
      {!isGpMode && (
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
      )}
    </tr>
  );};

  // Table header
  const raceColumnCount = isGpMode ? 5 : 3;
  const tableHeader = (
    <thead>
      <tr className="border-b border-gray-700 text-gray-400">
        <th className="text-left py-2 px-2 font-medium w-0">#</th>
        {isTeamClassic && <th className="py-2 px-1 font-medium w-0">Team</th>}
        <th className="text-left py-2 px-2 font-medium">Player</th>
        <th className="text-left py-2 px-2 font-medium w-8 sm:w-auto">
          <span className="sm:hidden">MC</span>
          <span className="hidden sm:inline">Machine</span>
        </th>
        {Array.from({ length: raceColumnCount }, (_, i) => (
          <th key={`rh${i + 1}`} className="text-center py-2 px-1 font-medium w-10">R{i + 1}</th>
        ))}
        <th className="text-right py-2 px-2 font-medium">Pts</th>
        <th className="text-center py-2 px-2 font-medium">Status</th>
        {!isGpMode && <th className="text-right py-2 px-2 font-medium">Rating</th>}
        {!isGpMode && <th className="text-right py-2 px-2 font-medium">+/-</th>}
      </tr>
    </thead>
  );

  // Sort teamScores by rank for display
  const sortedTeamScores = teamScores && teamScores.length > 0
    ? [...teamScores].sort((a, b) => a.rank - b.rank)
    : [];

  // Calculate team scores from participants if not provided (for IN_PROGRESS matches)
  const calculatedTeamScores: TeamScore[] = [];
  if (isTeamClassic && sortedTeamScores.length === 0) {
    const teamScoreMap = new Map<number, number>();
    participantsWithRank.forEach((p) => {
      if (p.teamIndex !== null && p.teamIndex !== undefined) {
        const currentScore = teamScoreMap.get(p.teamIndex) || 0;
        teamScoreMap.set(p.teamIndex, currentScore + (p.totalScore ?? 0));
      }
    });
    // Convert to array and sort by score descending
    const teamScoreArray = Array.from(teamScoreMap.entries())
      .map(([teamIndex, score]) => ({ teamIndex, score, rank: 0 }))
      .sort((a, b) => b.score - a.score);
    // Assign ranks
    teamScoreArray.forEach((team, index) => {
      team.rank = index + 1;
      calculatedTeamScores.push(team);
    });
  }

  // Use API-provided scores if available, otherwise use calculated scores
  const displayTeamScores = sortedTeamScores.length > 0 ? sortedTeamScores : calculatedTeamScores;

  // Calculate per-race scores for each team
  const teamRaceScores = new Map<number, { r1: number; r2: number; r3: number }>();
  if (isTeamClassic) {
    participantsWithRank.forEach((p) => {
      if (p.teamIndex === null || p.teamIndex === undefined) return;
      const current = teamRaceScores.get(p.teamIndex) || { r1: 0, r2: 0, r3: 0 };
      p.raceResults?.forEach((r) => {
        if (r.raceNumber === 1) current.r1 += r.points ?? 0;
        else if (r.raceNumber === 2) current.r2 += r.points ?? 0;
        else if (r.raceNumber === 3) current.r3 += r.points ?? 0;
      });
      teamRaceScores.set(p.teamIndex, current);
    });
  }

  // TEAM_CLASSIC: Render with team ranking summary and score-sorted table
  if (isTeamClassic && displayTeamScores.length > 0) {
    return (
      <div className="overflow-x-auto">
        {/* Team Ranking Table */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 px-2 font-medium w-0">#</th>
              <th className="text-left py-2 px-2 font-medium">Team</th>
              <th className="text-center py-2 px-1 font-medium w-10">R1</th>
              <th className="text-center py-2 px-1 font-medium w-10">R2</th>
              <th className="text-center py-2 px-1 font-medium w-10">R3</th>
              <th className="text-right py-2 px-2 font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {displayTeamScores.map((team) => {
              const races = teamRaceScores.get(team.teamIndex);
              return (
                <tr
                  key={team.teamIndex}
                  className="border-b border-gray-700/50"
                  style={teamColors[team.teamIndex]
                    ? { backgroundImage: `repeating-linear-gradient(135deg, ${teamColors[team.teamIndex]}1A, ${teamColors[team.teamIndex]}1A 4px, transparent 4px, transparent 8px)` }
                    : undefined}
                >
                  <td className={cn(
                    'py-2 px-2 font-bold',
                    team.rank <= 1 ? 'text-yellow-400' : 'text-gray-100'
                  )}>
                    {team.rank}
                  </td>
                  <td className="py-2 px-2 text-white">
                    Team {String.fromCharCode(65 + team.teamIndex)}
                  </td>
                  <td className="py-2 px-1 text-center text-gray-100">{races?.r1 ?? '-'}</td>
                  <td className="py-2 px-1 text-center text-gray-100">{races?.r2 ?? '-'}</td>
                  <td className="py-2 px-1 text-center text-gray-100">{races?.r3 ?? '-'}</td>
                  <td className="py-2 px-2 text-right font-medium text-white">
                    {team.score.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Score-sorted table with team color backgrounds */}
        <table className="w-full text-sm min-w-[500px] sm:min-w-[700px]">
          {tableHeader}
          <tbody>
            {participantsWithRank.map((participant) =>
              renderParticipantRow(participant, { showTeamColumn: true })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // Standard view (non-TEAM_CLASSIC)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[500px] sm:min-w-[700px]">
        {tableHeader}
        <tbody>
          {participantsWithRank.map((participant) =>
            renderParticipantRow(participant, { showTeamColumn: isTeamClassic })
          )}
        </tbody>
      </table>
    </div>
  );
}

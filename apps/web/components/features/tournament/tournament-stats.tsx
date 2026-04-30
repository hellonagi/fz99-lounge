'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ZAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Hash, Calendar, Trophy } from 'lucide-react';
import { F99_MACHINES } from '@/lib/machines';
import { tracksApi, type Track } from '@/lib/api';
import type { Tournament, GameParticipant } from '@/types';

const MACHINE_HEX: Record<string, string> = {
  'Blue Falcon': '#3b82f6',   // blue-500
  'Golden Fox': '#eab308',    // yellow-500
  'Wild Goose': '#22c55e',    // green-500
  'Fire Stingray': '#ec4899', // pink-500
};

const tooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StaggeredTick({ x, y, payload, index }: any) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const dy = isMobile && index % 2 !== 0 ? 22 : 8;
  return (
    <text x={x} y={y} dy={dy} textAnchor="middle" fill="#9ca3af" fontSize={12}>
      {payload.value}
    </text>
  );
}

interface TournamentStatsProps {
  tournament: Tournament;
}

interface PlayerScore {
  userId: number;
  totalScore: number;
}

interface MachineStats {
  name: string;
  abbr: string;
  uses: number;
  avgScore: number;
  color: string;
}

interface SurvivedStats {
  count: string;
  players: number;
}

interface ScoreVsSurvivedPoint {
  survived: number;
  totalScore: number;
  name: string;
}

interface RankedPlayer {
  rank: number;
  name: string;
  userId: number;
  value: number;
  sub?: string;
  profileNumber?: number;
  country?: string;
  survived?: number;
}

interface RankingCategory {
  key: string;
  label: string;
  valueLabel: string;
  players: RankedPlayer[];
}


interface ConsistencyPlayer {
  name: string;
  totalScore: number;
  stdDev: number;
  range: number;
  country?: string;
}

interface CountryStats {
  code: string;
  count: number;
  avgScore: number;
  medScore: number;
}

function computeStats(tournament: Tournament, overallLabel: string, leagueTrackNames: Map<string, string[]>) {
  const matches = tournament.season?.matches ?? [];
  const sortedMatches = [...matches].sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));

  // Collect all non-DQ participants per game
  const allParticipants: GameParticipant[] = [];
  for (const match of sortedMatches) {
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (!p.isDisqualified) {
          allParticipants.push(p);
        }
      }
    }
  }

  // Player total scores (sum across all rounds)
  const playerScores = new Map<number, number>();
  for (const p of allParticipants) {
    const prev = playerScores.get(p.userId) ?? 0;
    playerScores.set(p.userId, prev + (p.totalScore ?? 0));
  }

  // Exclude players with 0 total points
  const scores = [...playerScores.values()].filter((s) => s > 0);
  const uniquePlayerCount = scores.length;
  const roundCount = sortedMatches.length;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highScore = scores.length > 0 ? Math.max(...scores) : 0;
  const winnerUserId = [...playerScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // Score distribution (histogram) - fixed 1000-point buckets
  const scoreDistribution: { range: string; count: number }[] = [];
  if (scores.length > 0) {
    const bucketSize = 1000;
    const minS = Math.min(...scores);
    const maxS = Math.max(...scores);
    const bucketStart = Math.floor(minS / bucketSize) * bucketSize;
    const bucketEnd = Math.floor(maxS / bucketSize) * bucketSize;

    for (let start = bucketStart; start <= bucketEnd; start += bucketSize) {
      const count = scores.filter((s) => s >= start && s < start + bucketSize).length;
      scoreDistribution.push({
        range: `${start}-${start + bucketSize - 1}`,
        count,
      });
    }
    // Last bucket: include the upper bound
    if (scoreDistribution.length > 0) {
      const lastBucket = scoreDistribution[scoreDistribution.length - 1];
      const lastStart = bucketEnd;
      lastBucket.count = scores.filter((s) => s >= lastStart).length;
    }
  }

  // Machine usage
  const machineMap = new Map<string, { uses: number; totalScore: number }>();
  for (const p of allParticipants) {
    if (!p.machine) continue;
    const prev = machineMap.get(p.machine) ?? { uses: 0, totalScore: 0 };
    machineMap.set(p.machine, {
      uses: prev.uses + 1,
      totalScore: prev.totalScore + (p.totalScore ?? 0),
    });
  }

  const machineStats: MachineStats[] = F99_MACHINES.map((m) => {
    const data = machineMap.get(m.value);
    return {
      name: m.value,
      abbr: m.abbr,
      uses: data?.uses ?? 0,
      avgScore: data && data.uses > 0 ? Math.round(data.totalScore / data.uses) : 0,
      color: MACHINE_HEX[m.value] ?? '#9ca3af',
    };
  });

  // Machine usage per round
  const leagueLabel = (roundNumber: number): string => {
    const roundConfig = tournament.rounds?.find((r) => r.roundNumber === roundNumber);
    if (!roundConfig?.league) return `R${roundNumber}`;
    const name = roundConfig.league
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join('_');
    return name.replace('Mirror_', 'M.');
  };

  // Machine usage stacked bar data: each row = round, values = % per machine
  const buildMachineRow = (label: string, machineCounts: Map<string, number>) => {
    const total = [...machineCounts.values()].reduce((a, b) => a + b, 0);
    const row: Record<string, any> = { round: label };
    for (const m of F99_MACHINES) {
      row[m.value] = total > 0 ? Math.round(((machineCounts.get(m.value) ?? 0) / total) * 100) : 0;
    }
    return row;
  };

  // Overall row
  const overallCounts = new Map<string, number>();
  for (const p of allParticipants) {
    if (p.machine) overallCounts.set(p.machine, (overallCounts.get(p.machine) ?? 0) + 1);
  }

  const machineStackedData = [
    buildMachineRow(overallLabel, overallCounts),
    ...sortedMatches.map((match, i) => {
      const counts = new Map<string, number>();
      for (const game of match.games ?? []) {
        for (const p of game.participants ?? []) {
          if (!p.isDisqualified && p.machine) {
            counts.set(p.machine, (counts.get(p.machine) ?? 0) + 1);
          }
        }
      }
      return buildMachineRow(leagueLabel(i + 1), counts);
    }),
  ];

  // Country ranking: average & median total points per country
  const countryScores = new Map<string, number[]>();
  const seenUsers = new Set<number>();
  for (const [userId, total] of playerScores) {
    if (total <= 0) continue;
    if (seenUsers.has(userId)) continue;
    seenUsers.add(userId);
    const participant = allParticipants.find((p) => p.userId === userId);
    const code = (participant?.user as any)?.profile?.country || (participant?.user as any)?.country || 'UNKNOWN';
    const scores = countryScores.get(code) ?? [];
    scores.push(total);
    countryScores.set(code, scores);
  }

  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  };

  const countryStats: CountryStats[] = [...countryScores.entries()]
    .map(([code, scores]) => ({
      code,
      count: scores.length,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      medScore: median(scores),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // Survived distribution: count how many GPs each player survived
  const playerSurvivedCount = new Map<number, number>();
  for (const match of sortedMatches) {
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || p.totalScore == null || (p.totalScore ?? 0) === 0) continue;
        const survived = p.eliminatedAtRace == null && !p.isCompensated;
        if (survived) {
          playerSurvivedCount.set(p.userId, (playerSurvivedCount.get(p.userId) ?? 0) + 1);
        } else if (!playerSurvivedCount.has(p.userId)) {
          playerSurvivedCount.set(p.userId, 0);
        }
      }
    }
  }

  const survivedDistribution: SurvivedStats[] = [];
  if (roundCount > 0) {
    const buckets = new Map<number, number>();
    for (const count of playerSurvivedCount.values()) {
      buckets.set(count, (buckets.get(count) ?? 0) + 1);
    }
    for (let i = 0; i <= roundCount; i++) {
      survivedDistribution.push({
        count: `${i}`,
        players: buckets.get(i) ?? 0,
      });
    }
  }

  // Build userId -> displayName map
  const playerNames = new Map<number, string>();
  for (const p of allParticipants) {
    if (!playerNames.has(p.userId) && p.user) {
      playerNames.set(p.userId, p.user.displayName || p.user.username || `Player ${p.userId}`);
    }
  }

  const winnerName = winnerUserId != null ? (playerNames.get(winnerUserId) ?? '') : '';
  const winnerParticipant = winnerUserId != null ? allParticipants.find((p) => p.userId === winnerUserId) : undefined;
  const winnerCountry: string | undefined = (winnerParticipant?.user as any)?.profile?.country || (winnerParticipant?.user as any)?.country || undefined;

  // Score vs Survived scatter data
  const scoreVsSurvived: ScoreVsSurvivedPoint[] = [];
  for (const [userId, survivedCount] of playerSurvivedCount) {
    const total = playerScores.get(userId) ?? 0;
    if (total > 0) {
      scoreVsSurvived.push({
        survived: survivedCount,
        totalScore: total,
        name: playerNames.get(userId) ?? `Player ${userId}`,
      });
    }
  }

  // Helper: build ranked list
  const buildRanking = (
    entries: [number, number][],
    subFn?: (userId: number) => string | undefined,
    opts?: { showSurvived?: boolean },
  ): RankedPlayer[] => {
    const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
    let currentRank = 1;
    return sorted.map(([userId, value], i) => {
      if (i > 0 && value !== sorted[i - 1][1]) currentRank = i + 1;
      const participant = allParticipants.find((p) => p.userId === userId);
      return {
        rank: currentRank,
        name: playerNames.get(userId) ?? `Player ${userId}`,
        userId,
        value,
        sub: subFn?.(userId),
        profileNumber: participant?.user?.profileNumber,
        country: (participant?.user as any)?.profile?.country || (participant?.user as any)?.country || undefined,
        survived: opts?.showSurvived ? (playerSurvivedCount.get(userId) ?? 0) : undefined,
      };
    });
  };

  // 1) Total Points Top 10
  const pointsRanking = buildRanking(
    [...playerScores.entries()].filter(([, s]) => s > 0),
    (uid) => `${playerSurvivedCount.get(uid) ?? 0} survived`,
  );

  // 2) Survived Top 10
  const survivedRanking = buildRanking(
    [...playerSurvivedCount.entries()],
    (uid) => `${playerScores.get(uid) ?? 0} pts`,
  );

  // 3) Avg points when survived Top 10
  const playerSurvivedScores = new Map<number, number[]>();
  for (const match of sortedMatches) {
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || p.totalScore == null || p.totalScore === 0) continue;
        const survived = p.eliminatedAtRace == null && !p.isCompensated;
        if (survived) {
          const arr = playerSurvivedScores.get(p.userId) ?? [];
          arr.push(p.totalScore);
          playerSurvivedScores.set(p.userId, arr);
        }
      }
    }
  }
  const avgSurvivedRanking = buildRanking(
    [...playerSurvivedScores.entries()]
      .filter(([, scores]) => scores.length >= 2)
      .map(([uid, scores]) => [uid, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)] as [number, number]),
    (uid) => `${playerSurvivedScores.get(uid)?.length ?? 0} GPs`,
  );

  // 4) GP Highest Points: top single-GP scores (same player can appear multiple times)
  const gpHighEntries: RankedPlayer[] = [];
  for (const match of sortedMatches) {
    const roundLabel = leagueLabel(match.matchNumber ?? 0);
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || p.totalScore == null || p.totalScore === 0) continue;
        const participant = allParticipants.find((pp) => pp.userId === p.userId);
        gpHighEntries.push({
          rank: 0,
          name: playerNames.get(p.userId) ?? `Player ${p.userId}`,
          userId: p.userId,
          value: p.totalScore,
          sub: roundLabel,
          profileNumber: participant?.user?.profileNumber,
          country: (participant?.user as any)?.profile?.country || (participant?.user as any)?.country || undefined,
        });
      }
    }
  }
  const gpHighRanking = gpHighEntries
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  // 5) GP Wins: count how many times each player finished 1st in a GP
  const gpWinCount = new Map<number, number>();
  const gpWinLabels = new Map<number, string[]>();
  for (const match of sortedMatches) {
    const roundLabel = leagueLabel(match.matchNumber ?? 0);
    for (const game of match.games ?? []) {
      const validParticipants = (game.participants ?? [])
        .filter((p) => !p.isDisqualified && p.totalScore != null && p.totalScore > 0);
      if (validParticipants.length === 0) continue;
      const maxScore = Math.max(...validParticipants.map((p) => p.totalScore!));
      for (const p of validParticipants) {
        if (p.totalScore === maxScore) {
          gpWinCount.set(p.userId, (gpWinCount.get(p.userId) ?? 0) + 1);
          const labels = gpWinLabels.get(p.userId) ?? [];
          labels.push(roundLabel);
          gpWinLabels.set(p.userId, labels);
        }
      }
    }
  }
  const gpWinsRanking = buildRanking(
    [...gpWinCount.entries()],
    (uid) => gpWinLabels.get(uid)?.join(', ') ?? '',
  );

  // 6) Race Wins: count how many times each player finished 1st in a single race
  const raceWinCount = new Map<number, number>();
  const raceWinTracks = new Map<number, string[]>();
  for (const match of sortedMatches) {
    for (const game of match.games ?? []) {
      const league = game.leagueType ?? '';
      const leagueTracks = leagueTrackNames.get(league) ?? [];
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || !p.raceResults) continue;
        for (const r of p.raceResults) {
          if (r.position === 1) {
            raceWinCount.set(p.userId, (raceWinCount.get(p.userId) ?? 0) + 1);
            const isMirror = league.startsWith('MIRROR_');
            const baseName = leagueTracks[r.raceNumber - 1] ?? `R${r.raceNumber}`;
            const trackName = isMirror ? `Mirror ${baseName}` : baseName;
            if (!raceWinTracks.has(p.userId)) raceWinTracks.set(p.userId, []);
            raceWinTracks.get(p.userId)!.push(trackName);
          }
        }
      }
    }
  }
  const raceWinsRanking = buildRanking(
    [...raceWinCount.entries()],
    (uid) => raceWinTracks.get(uid)?.join(', ') ?? '',
  );

  // 7) Machine-specific Top 10: aggregate scores only from GPs where the player used that machine
  const playerMachineScores = new Map<number, Map<string, { total: number; count: number }>>();
  for (const p of allParticipants) {
    if (!p.machine || p.totalScore == null || p.totalScore === 0) continue;
    if (!playerMachineScores.has(p.userId)) playerMachineScores.set(p.userId, new Map());
    const mMap = playerMachineScores.get(p.userId)!;
    const prev = mMap.get(p.machine) ?? { total: 0, count: 0 };
    mMap.set(p.machine, { total: prev.total + p.totalScore, count: prev.count + 1 });
  }

  const machineRankings: RankingCategory[] = F99_MACHINES.map((m) => {
    const players: [number, number][] = [];
    for (const [userId, mMap] of playerMachineScores) {
      const data = mMap.get(m.value);
      if (data && data.total > 0) {
        players.push([userId, data.total]);
      }
    }
    return {
      key: m.value,
      label: m.abbr,
      valueLabel: 'points',
      players: buildRanking(players, (uid) => {
        const data = playerMachineScores.get(uid)?.get(m.value);
        return `${data?.count ?? 0} GPs`;
      }, { showSurvived: true }),
    };
  }).filter((r) => r.players.length > 0);

  const rankings: RankingCategory[] = [
    { key: 'points', label: 'rankingPoints', valueLabel: 'points', players: pointsRanking },
    { key: 'survived', label: 'rankingSurvived', valueLabel: 'survived', players: survivedRanking },
    { key: 'gpWins', label: 'rankingGpWins', valueLabel: 'wins', players: gpWinsRanking },
    { key: 'gpHigh', label: 'rankingGpHigh', valueLabel: 'points', players: gpHighRanking },
    { key: 'raceWins', label: 'rankingRaceWins', valueLabel: 'wins', players: raceWinsRanking },
    { key: 'avgSurvived', label: 'rankingAvgSurvived', valueLabel: 'points', players: avgSurvivedRanking },
    ...machineRankings,
  ];

  // Machine avg/median score per round (for line charts)

  const machineRoundData = sortedMatches.map((match, i) => {
    const roundLabel = leagueLabel(match.matchNumber ?? (i + 1));
    const machineScores = new Map<string, number[]>();
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || !p.machine || p.totalScore == null || p.totalScore === 0) continue;
        const arr = machineScores.get(p.machine) ?? [];
        arr.push(p.totalScore);
        machineScores.set(p.machine, arr);
      }
    }
    return { roundLabel, machineScores };
  });

  const machineScoreByRound: Record<string, any>[] = machineRoundData.map(({ roundLabel, machineScores }) => {
    const row: Record<string, any> = { round: roundLabel };
    for (const m of F99_MACHINES) {
      const scores = machineScores.get(m.value);
      row[m.value] = scores && scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    }
    return row;
  });

  const machineHighestByRound: Record<string, any>[] = machineRoundData.map(({ roundLabel, machineScores }) => {
    const row: Record<string, any> = { round: roundLabel };
    for (const m of F99_MACHINES) {
      const scores = machineScores.get(m.value);
      row[m.value] = scores && scores.length > 0 ? Math.max(...scores) : null;
    }
    return row;
  });

  const machineMedianByRound: Record<string, any>[] = machineRoundData.map(({ roundLabel, machineScores }) => {
    const row: Record<string, any> = { round: roundLabel };
    for (const m of F99_MACHINES) {
      const scores = machineScores.get(m.value);
      row[m.value] = scores && scores.length > 0 ? median(scores) : null;
    }
    return row;
  });

  // Machine average survives per round (for line chart)
  const machineSurvivedByRound: Record<string, any>[] = sortedMatches.map((match, i) => {
    const roundLabel = leagueLabel(match.matchNumber ?? (i + 1));
    const machineCounts = new Map<string, { survived: number; total: number }>();
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || !p.machine || p.totalScore == null || p.totalScore === 0) continue;
        const prev = machineCounts.get(p.machine) ?? { survived: 0, total: 0 };
        prev.total++;
        if (p.eliminatedAtRace == null && !p.isCompensated) prev.survived++;
        machineCounts.set(p.machine, prev);
      }
    }
    const row: Record<string, any> = { round: roundLabel };
    for (const m of F99_MACHINES) {
      const data = machineCounts.get(m.value);
      row[m.value] = data ? data.survived : null;
    }
    return row;
  });

  // Score consistency: per-round scores std dev for players with 3+ rounds
  const playerRoundScores = new Map<number, number[]>();
  for (const match of sortedMatches) {
    for (const game of match.games ?? []) {
      for (const p of game.participants ?? []) {
        if (p.isDisqualified || p.totalScore == null || p.totalScore === 0) continue;
        const arr = playerRoundScores.get(p.userId) ?? [];
        arr.push(p.totalScore);
        playerRoundScores.set(p.userId, arr);
      }
    }
  }

  const consistencyPlayers: ConsistencyPlayer[] = [];
  for (const [userId, roundScoresArr] of playerRoundScores) {
    if (roundScoresArr.length < 3) continue;
    const total = playerScores.get(userId) ?? 0;
    if (total < 3000) continue;
    const mean = roundScoresArr.reduce((a, b) => a + b, 0) / roundScoresArr.length;
    const variance = roundScoresArr.reduce((sum, s) => sum + (s - mean) ** 2, 0) / roundScoresArr.length;
    const stdDev = Math.round(Math.sqrt(variance));
    const range = Math.max(...roundScoresArr) - Math.min(...roundScoresArr);
    const participant = allParticipants.find((p) => p.userId === userId);
    consistencyPlayers.push({
      name: playerNames.get(userId) ?? `Player ${userId}`,
      totalScore: Math.round(mean),
      stdDev,
      range,
      country: (participant?.user as any)?.profile?.country || (participant?.user as any)?.country || undefined,
    });
  }
  // Sort by stdDev ascending = most consistent first
  consistencyPlayers.sort((a, b) => a.stdDev - b.stdDev);
  const mostConsistent = consistencyPlayers.slice(0, 10);
  const leastConsistent = [...consistencyPlayers].sort((a, b) => b.stdDev - a.stdDev).slice(0, 10);

  return {
    uniquePlayerCount,
    roundCount,
    avgScore,
    highScore,
    winnerName,
    winnerCountry,
    scoreDistribution,
    machineStats,
    machineStackedData,
    survivedDistribution,
    scoreVsSurvived,
    rankings,
    machineScoreByRound,
    machineHighestByRound,
    machineMedianByRound,
    machineSurvivedByRound,
    mostConsistent,
    leastConsistent,
    countryStats,
  };
}

export function TournamentStats({ tournament }: TournamentStatsProps) {
  const t = useTranslations('tournament.stats');

  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const [leagueTrackNames, setLeagueTrackNames] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    tracksApi.getAll().then((res) => {
      const byLeague = new Map<string, Track[]>();
      for (const tr of res.data) {
        const list = byLeague.get(tr.league) ?? [];
        list.push(tr);
        byLeague.set(tr.league, list);
      }
      const result = new Map<string, string[]>();
      for (const [league, tracks] of byLeague) {
        result.set(league, tracks.sort((a, b) => a.id - b.id).map((t) => t.name));
      }
      setLeagueTrackNames(result);
    });
  }, []);

  const overallLabel = t('overall');
  const stats = useMemo(() => computeStats(tournament, overallLabel, leagueTrackNames), [tournament, overallLabel, leagueTrackNames]);

  if (stats.uniquePlayerCount === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        {t('noData')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Calendar className="h-5 w-5 text-green-400" />} label={t('date')} value={new Date(tournament.tournamentDate).toLocaleDateString()} />
        <SummaryCard icon={<Users className="h-5 w-5 text-blue-400" />} label={t('participants')} value={stats.uniquePlayerCount} />
        <SummaryCard icon={<Hash className="h-5 w-5 text-red-400" />} label={t('format')} value={`${stats.roundCount} GPs`} />
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-xs text-gray-400">{t('winner')}</p>
              <p className="text-xl font-bold text-white inline-flex items-center gap-2">
                {stats.winnerCountry && <span className={`fi fi-${stats.winnerCountry.toLowerCase()} text-base`} />}
                {stats.winnerName}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      {stats.rankings.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">{t('topPlayers')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue={stats.rankings[0].key}>
              <div className="overflow-x-auto">
              <TabsList className="px-3 w-max">
                {stats.rankings.map((r) => (
                  <TabsTrigger key={r.key} value={r.key} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                    {F99_MACHINES.find((m) => m.value === r.key)
                      ? F99_MACHINES.find((m) => m.value === r.key)!.abbr
                      : t(r.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
              </div>
              {stats.rankings.map((r) => (
                <TabsContent key={r.key} value={r.key}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700/50 text-left text-gray-400">
                          <th className="px-1 py-1.5 sm:px-3 sm:py-2 w-6 sm:w-10">{t('rank')}</th>
                          <th className="px-1 py-1.5 sm:px-3 sm:py-2">{t('player')}</th>
                          <th className="px-1 py-1.5 sm:px-3 sm:py-2 text-right">{r.valueLabel ? t(r.valueLabel) : t('points')}</th>
                          {r.players[0]?.survived !== undefined && (
                            <th className="px-1 py-1.5 sm:px-3 sm:py-2 text-right">{t('survivedCount')}</th>
                          )}
                          <th className="px-1 py-1.5 sm:px-3 sm:py-2 text-right" />
                        </tr>
                      </thead>
                      <tbody>
                        {r.players.map((p, idx) => (
                          <tr key={`${p.userId}-${idx}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-gray-400">{p.rank}</td>
                            <td className="px-1 py-1.5 sm:px-3 sm:py-2 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                {p.country && <span className={`fi fi-${p.country.toLowerCase()}`} />}
                                {p.profileNumber ? (
                                  <Link href={`/profile/${p.profileNumber}`} className="text-white hover:text-blue-400 hover:underline">
                                    {p.name}
                                  </Link>
                                ) : (
                                  <span className="text-white">{p.name}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-right font-medium text-white">{p.value}</td>
                            {p.survived !== undefined && (
                              <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-right text-gray-300">{p.survived}</td>
                            )}
                            <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-right text-gray-400 text-xs">{p.sub}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Score Distribution */}
      {stats.scoreDistribution.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">{t('scoreDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <BarChart data={stats.scoreDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="range" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} width={30} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [value, t('playerCount')]}
                  labelFormatter={(label) => `${t('scoreRange')}: ${label}`}
                />
                <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Survived Distribution */}
      {stats.survivedDistribution.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">{t('survivedDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <BarChart data={stats.survivedDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="count" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} width={30} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [value, t('playerCount')]}
                  labelFormatter={(label) => `${t('survivedCount')}: ${label}`}
                />
                <Bar dataKey="players" fill="#4ade80" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Score vs Survived Scatter */}
      {stats.scoreVsSurvived.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">{t('scoreVsSurvived')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  dataKey="totalScore"
                  name={t('totalScore')}
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="survived"
                  name={t('survivedCount')}
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  allowDecimals={false}
                  width={30}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as ScoreVsSurvivedPoint;
                    return (
                      <div style={{ ...tooltipStyle, padding: '8px 12px', color: '#fff', fontSize: 13 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{point.name}</div>
                        <div>{t('totalScore')}: {point.totalScore}</div>
                        <div>{t('survivedCount')}: {point.survived}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={stats.scoreVsSurvived} fill="#60a5fa" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Machine Usage */}
      {stats.machineStackedData.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('machineUsage')}
              <span className="ml-3 inline-flex gap-3 text-xs font-normal">
                {F99_MACHINES.map((m) => (
                  <span key={m.value} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MACHINE_HEX[m.value] }} />
                    {m.abbr}
                  </span>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={stats.machineStackedData.length * 36 + 20} minWidth={0}>
              <BarChart data={stats.machineStackedData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} stackOffset="expand" barSize={20}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="round" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} width={70} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const machine = F99_MACHINES.find((m) => m.value === name);
                    return [`${value}%`, machine?.name ?? name];
                  }}
                />
                {F99_MACHINES.map((m) => (
                  <Bar key={m.value} dataKey={m.value} stackId="machine" fill={MACHINE_HEX[m.value]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Machine Highest Score by Round */}
      {stats.machineHighestByRound.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('machineHighestScore')}
              <span className="ml-3 inline-flex gap-3 text-xs font-normal">
                {F99_MACHINES.map((m) => (
                  <span key={m.value} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MACHINE_HEX[m.value] }} />
                    {m.abbr}
                  </span>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <LineChart data={stats.machineHighestByRound} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="round" stroke="#9ca3af" tick={<StaggeredTick />} interval={0} height={40} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} width={40} domain={[200, 'auto']} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const machine = F99_MACHINES.find((m) => m.value === name);
                    return [value, machine?.name ?? name];
                  }}
                />
                {F99_MACHINES.map((m) => (
                  <Line
                    key={m.value}
                    type="linear"
                    dataKey={m.value}
                    stroke={MACHINE_HEX[m.value]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: MACHINE_HEX[m.value] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Machine Avg Score by Round */}
      {stats.machineScoreByRound.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('machineAvgScore')}
              <span className="ml-3 inline-flex gap-3 text-xs font-normal">
                {F99_MACHINES.map((m) => (
                  <span key={m.value} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MACHINE_HEX[m.value] }} />
                    {m.abbr}
                  </span>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <LineChart data={stats.machineScoreByRound} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="round" stroke="#9ca3af" tick={<StaggeredTick />} interval={0} height={40} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const machine = F99_MACHINES.find((m) => m.value === name);
                    return [value, machine?.name ?? name];
                  }}
                />
                {F99_MACHINES.map((m) => (
                  <Line
                    key={m.value}
                    type="linear"
                    dataKey={m.value}
                    stroke={MACHINE_HEX[m.value]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: MACHINE_HEX[m.value] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Machine Median Score by Round */}
      {stats.machineMedianByRound.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('machineMedianScore')}
              <span className="ml-3 inline-flex gap-3 text-xs font-normal">
                {F99_MACHINES.map((m) => (
                  <span key={m.value} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MACHINE_HEX[m.value] }} />
                    {m.abbr}
                  </span>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <LineChart data={stats.machineMedianByRound} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="round" stroke="#9ca3af" tick={<StaggeredTick />} interval={0} height={40} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const machine = F99_MACHINES.find((m) => m.value === name);
                    return [value, machine?.name ?? name];
                  }}
                />
                {F99_MACHINES.map((m) => (
                  <Line
                    key={m.value}
                    type="linear"
                    dataKey={m.value}
                    stroke={MACHINE_HEX[m.value]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: MACHINE_HEX[m.value] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Machine Survive Rate by Round */}
      {stats.machineSurvivedByRound.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('machineSurvivedRate')}
              <span className="ml-3 inline-flex gap-3 text-xs font-normal">
                {F99_MACHINES.map((m) => (
                  <span key={m.value} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MACHINE_HEX[m.value] }} />
                    {m.abbr}
                  </span>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              <LineChart data={stats.machineSurvivedByRound} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="round" stroke="#9ca3af" tick={<StaggeredTick />} interval={0} height={40} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} width={40} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const machine = F99_MACHINES.find((m) => m.value === name);
                    return [value, machine?.name ?? name];
                  }}
                />
                {F99_MACHINES.map((m) => (
                  <Line
                    key={m.value}
                    type="linear"
                    dataKey={m.value}
                    stroke={MACHINE_HEX[m.value]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: MACHINE_HEX[m.value] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Score Consistency */}
      {stats.mostConsistent.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">{t('consistency')} <span className="text-sm font-normal text-gray-400">{`(> 3000 pts)`}</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-green-400 mb-2">{t('mostConsistent')}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/50 text-left text-gray-400">
                      <th className="px-2 py-1.5">{t('player')}</th>
                      <th className="px-2 py-1.5 text-right">{t('avgPoints')}</th>
                      <th className="px-2 py-1.5 text-right">{t('stdDev')}</th>
                      <th className="px-2 py-1.5 text-right">{t('range')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.mostConsistent.map((p) => (
                      <tr key={p.name} className="border-b border-gray-700/50">
                        <td className="px-2 py-1.5 text-white whitespace-nowrap"><span className="inline-flex items-center gap-1.5">{p.country && <span className={`fi fi-${p.country.toLowerCase()}`} />}{p.name}</span></td>
                        <td className="px-2 py-1.5 text-right text-gray-300">{p.totalScore}</td>
                        <td className="px-2 py-1.5 text-right text-green-400">{p.stdDev}</td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{p.range}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">{t('leastConsistent')}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/50 text-left text-gray-400">
                      <th className="px-2 py-1.5">{t('player')}</th>
                      <th className="px-2 py-1.5 text-right">{t('avgPoints')}</th>
                      <th className="px-2 py-1.5 text-right">{t('stdDev')}</th>
                      <th className="px-2 py-1.5 text-right">{t('range')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.leastConsistent.map((p) => (
                      <tr key={p.name} className="border-b border-gray-700/50">
                        <td className="px-2 py-1.5 text-white whitespace-nowrap"><span className="inline-flex items-center gap-1.5">{p.country && <span className={`fi fi-${p.country.toLowerCase()}`} />}{p.name}</span></td>
                        <td className="px-2 py-1.5 text-right text-gray-300">{p.totalScore}</td>
                        <td className="px-2 py-1.5 text-right text-blue-400">{p.stdDev}</td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{p.range}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Country Ranking */}
      {stats.countryStats.length > 0 && stats.countryStats[0].code !== 'UNKNOWN' && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">{t('countryRanking')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50 text-left text-gray-400">
                    <th className="px-1 py-1.5 sm:px-3 sm:py-2 w-6 sm:w-10">#</th>
                    <th className="px-1 py-1.5 sm:px-3 sm:py-2">{t('country')}</th>
                    <th className="px-1 py-1.5 sm:px-3 sm:py-2 text-right">{t('avgPoints')}</th>
                    <th className="px-1 py-1.5 sm:px-3 sm:py-2 text-right">{t('medPoints')}</th>
                    <th className="px-1 py-1.5 sm:px-3 sm:py-2 text-right">{t('playerCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.countryStats.map((c, i) => (
                    <tr key={c.code} className="border-b border-gray-700/50">
                      <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-gray-400">{i + 1}</td>
                      <td className="px-1 py-1.5 sm:px-3 sm:py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span className={`fi fi-${c.code.toLowerCase()}`} />
                          <span className="text-white">{regionNames.of(c.code.toUpperCase()) ?? c.code.toUpperCase()}</span>
                        </span>
                      </td>
                      <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-right font-medium text-white">{c.avgScore}</td>
                      <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-right font-medium text-white">{c.medScore}</td>
                      <td className="px-1 py-1.5 sm:px-3 sm:py-2 text-right text-gray-400">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}


function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

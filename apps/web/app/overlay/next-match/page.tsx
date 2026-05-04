'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { matchesApi, usersApi, gamesApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { NextMatchOverlay, type Phase } from '@/components/features/overlay/next-match-overlay';

type LeaderboardCategory = 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';

function categoryToLeaderboardMode(category?: string): LeaderboardCategory {
  const c = category?.toUpperCase();
  if (c === 'CLASSIC' || c === 'TEAM_CLASSIC' || c === 'TEAM_GP' || c === 'GP') {
    return c;
  }
  return 'GP';
}

async function enrichParticipants(match: Match): Promise<Participant[]> {
  if (!match.participants?.length) return match.participants;

  const mode = categoryToLeaderboardMode(
    match.category || match.season?.event?.category,
  );
  const seasonNumber = match.season?.seasonNumber;
  if (seasonNumber === undefined || seasonNumber < 0) return match.participants;

  try {
    const res = await usersApi.getLeaderboard(mode, seasonNumber, 1, 500);
    const data: Array<{
      displayRating: number;
      user: { id: number; profile?: { country: string | null } | null };
    }> = res.data?.data ?? [];

    const map = new Map<number, { rank: number; country: string | null; displayRating: number }>();
    data.forEach((row, i) => {
      map.set(row.user.id, {
        rank: i + 1,
        country: row.user.profile?.country ?? null,
        displayRating: row.displayRating,
      });
    });

    return match.participants.map((p) => {
      const lb = map.get(p.userId);
      return lb ? { ...p, rank: lb.rank, country: lb.country, displayRating: lb.displayRating } : p;
    });
  } catch {
    return match.participants;
  }
}

interface Participant {
  userId: number;
  user: {
    id: number;
    discordId: string;
    displayName: string | null;
    avatarHash: string | null;
    profile?: { country: string | null } | null;
  };
  rank?: number | null;
  country?: string | null;
  displayRating?: number | null;
  liveScore?: number | null;
  liveStatus?: string | null;
}

interface Match {
  id: number;
  category: string;
  leagueType: string | null;
  matchNumber: number;
  scheduledStart: string;
  currentPlayers: number;
  maxPlayers: number;
  minPlayers: number;
  season: {
    id: number;
    seasonNumber: number;
    event: { id: number; category: string };
  };
  participants: Participant[];
  games?: Array<{ id: number; gameNumber: number }>;
}

const MATCH_DISPLAY_DURATION: Record<string, number> = {
  classic: 10,
  team_classic: 12,
  gp: 15,
  team_gp: 17,
};

export default function NextMatchOverlayPage() {
  return (
    <Suspense fallback={<div style={{ width: 250, height: 400 }} />}>
      <OverlayContent />
    </Suspense>
  );
}

function OverlayContent() {
  const params = useSearchParams();
  const lang = params.get('lang') === 'ja' ? 'ja' : 'en';
  const demo = params.get('demo');
  const phaseParam = params.get('phase');
  const forcePhase: Phase | undefined =
    phaseParam === 'idle' || phaseParam === 'flash' || phaseParam === 'reveal' || phaseParam === 'roster'
      ? phaseParam
      : undefined;

  const [match, setMatch] = useState<Match | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isInProgress, setIsInProgress] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [liveResults, setLiveResults] = useState<Map<number, { totalScore: number | null; status: string | null; country?: string | null }>>(new Map());
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;

  // Demo mode: cycles waiting → match-found animation → roster → repeat
  useEffect(() => {
    if (!demo) return;
    const demoData = [
      { name: 'nag', country: 'JP', rank: 1, rating: 2150 },
      { name: 'Carson81', country: 'US', rank: 4, rating: 1980 },
      { name: 'Danyka43', country: 'GB', rank: 7, rating: 1840 },
      { name: 'Wilma33', country: 'DE', rank: 12, rating: 1720 },
      { name: 'Katheryn05', country: 'FR', rank: 18, rating: 1610 },
      { name: 'Susie33', country: 'CA', rank: 23, rating: 1540 },
      { name: 'Lawrence08', country: 'AU', rank: 31, rating: 1450 },
      { name: 'Audie26', country: 'BR', rank: 45, rating: 1310 },
      { name: 'Jewel69', country: 'KR', rank: 52, rating: 1240 },
      { name: 'Ewald69', country: 'IT', rank: 68, rating: 1100 },
      { name: 'Maureen06', country: 'ES', rank: null, rating: null },
    ];
    const fakeParticipants: Participant[] = demoData.map((d, i) => ({
      userId: i + 1,
      user: {
        id: i + 1,
        discordId: `${100000000000000000 + i}`,
        displayName: d.name,
        avatarHash: null,
      },
      country: d.country,
      rank: d.rank,
      displayRating: d.rating,
    }));
    const fakeMatch: Match = {
      id: 9999,
      category: 'GP',
      leagueType: 'KNIGHT',
      matchNumber: 3,
      scheduledStart: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      currentPlayers: fakeParticipants.length,
      maxPlayers: 30,
      minPlayers: 10,
      season: { id: 9, seasonNumber: 1, event: { id: 3, category: 'GP' } },
      participants: fakeParticipants,
    };

    setMatch(fakeMatch);
    setHasError(false);
    setLoaded(true);

    // Cycle: waiting → in_progress → repeat. demo=fast for short cycle.
    const waitMs = demo === 'fast' ? 1500 : 4000;
    const cycleMs = demo === 'fast' ? 8000 : 12000;
    let active = true;
    const cycle = () => {
      if (!active) return;
      setIsInProgress(false);
      setMatch({
        ...fakeMatch,
        scheduledStart: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      setTimeout(() => {
        if (!active) return;
        setIsInProgress(true);
        setMatch({
          ...fakeMatch,
          scheduledStart: new Date().toISOString(),
        });
      }, waitMs);
      setTimeout(cycle, cycleMs);
    };
    cycle();
    return () => {
      active = false;
    };
  }, [demo]);

  const fetchData = async () => {
    try {
      const inProgressRes = await matchesApi.getAll(undefined, 'IN_PROGRESS');
      const inProgressMatches = inProgressRes.data;

      if (inProgressMatches && inProgressMatches.length > 0) {
        const m: Match = inProgressMatches[0];
        const cat =
          m.category?.toLowerCase() ||
          m.season?.event?.category?.toLowerCase() ||
          'gp';
        const durationMin = MATCH_DISPLAY_DURATION[cat] ?? 15;
        const startedAt = new Date(m.scheduledStart).getTime();
        const elapsed = (Date.now() - startedAt) / 60000;
        if (elapsed < durationMin) {
          const enriched = await enrichParticipants(m);
          setMatch({ ...m, participants: enriched });
          setIsInProgress(true);
          setHasError(false);
          setLoaded(true);
          return;
        }
      }

      setIsInProgress(false);
      const res = await matchesApi.getNext();
      if (res.data.serverTime) {
        setTimeOffset(new Date(res.data.serverTime).getTime() - Date.now());
      }
      if (res.data.match) {
        setMatch(res.data.match);
        setHasError(false);
      } else {
        setMatch(null);
        setHasError(true);
      }
    } catch {
      setMatch(null);
      setHasError(true);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (demo) return;
    fetchData();

    const socket = getSocket();
    const onUpdated = (data: Match) => {
      if (matchRef.current?.id === data.id) setMatch(data);
    };
    const onStarted = () => fetchData();
    const onCancelled = (data: { matchId: number }) => {
      if (matchRef.current?.id === data.matchId) fetchData();
    };
    socket.on('match-updated', onUpdated);
    socket.on('match-started', onStarted);
    socket.on('match-cancelled', onCancelled);

    const poll = setInterval(fetchData, 30000);

    return () => {
      socket.off('match-updated', onUpdated);
      socket.off('match-started', onStarted);
      socket.off('match-cancelled', onCancelled);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // Live game results: fetch + subscribe when in_progress
  const gameId = isInProgress ? match?.games?.[0]?.id : undefined;

  // Demo live scores: simulate participants submitting scores over time
  useEffect(() => {
    if (!demo || !isInProgress || !match?.participants?.length) {
      setLiveResults(new Map());
      return;
    }
    const ids = match.participants.map((p) => p.userId);
    let active = true;
    let i = 0;
    setLiveResults(new Map());
    const submit = () => {
      if (!active || i >= ids.length) return;
      const userId = ids[i];
      const score = Math.floor(Math.random() * 80) + 20; // 20-100
      setLiveResults((prev) => {
        const next = new Map(prev);
        next.set(userId, { totalScore: score, status: 'PENDING' });
        return next;
      });
      i += 1;
      setTimeout(submit, 700);
    };
    const t = setTimeout(submit, 1500);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [demo, isInProgress, match?.participants]);

  useEffect(() => {
    if (demo || !gameId) {
      setLiveResults(new Map());
      return;
    }

    const updateFromGame = async () => {
      try {
        const res = await gamesApi.getById(gameId);
        const participants: Array<{
          userId: number;
          totalScore: number | null;
          status: string | null;
          user?: { profile?: { country: string | null } | null };
        }> = res.data?.participants ?? [];
        const m = new Map<number, { totalScore: number | null; status: string | null; country?: string | null }>();
        participants.forEach((p) => {
          m.set(p.userId, {
            totalScore: p.totalScore ?? null,
            status: p.status ?? null,
            country: p.user?.profile?.country ?? null,
          });
        });
        setLiveResults(m);
      } catch {
        // ignore
      }
    };

    updateFromGame();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const gameSocket: Socket = io(`${baseUrl}/games`, { withCredentials: true });
    gameSocket.on('connect', () => gameSocket.emit('joinGame', gameId));
    gameSocket.on('scoreUpdated', (participant: { userId: number; totalScore: number | null; status: string | null }) => {
      setLiveResults((prev) => {
        const next = new Map(prev);
        const existing = next.get(participant.userId);
        next.set(participant.userId, {
          totalScore: participant.totalScore ?? null,
          status: participant.status ?? null,
          country: existing?.country ?? null,
        });
        return next;
      });
    });

    return () => {
      gameSocket.emit('leaveGame', gameId);
      gameSocket.disconnect();
    };
  }, [demo, gameId]);

  if (!loaded) return <div style={{ width: 250, height: 400 }} />;

  // Merge live results into participants when in_progress.
  // Country falls back through: liveResults → participant.country (from leaderboard) → user.profile.country (from match endpoint).
  const enrichedParticipants = match?.participants?.map((p) => {
    const live = liveResults.get(p.userId);
    const country = live?.country ?? p.country ?? p.user?.profile?.country ?? null;
    if (!live) return { ...p, country };
    return {
      ...p,
      country,
      liveScore: live.totalScore,
      liveStatus: live.status,
    };
  });

  return (
    <NextMatchOverlay
      category={match?.category ?? match?.season?.event?.category}
      season={match?.season?.seasonNumber}
      match={match?.matchNumber}
      league={match?.leagueType}
      currentPlayers={match?.currentPlayers ?? match?.participants?.length}
      minPlayers={match?.minPlayers}
      maxPlayers={match?.maxPlayers}
      scheduledStart={match?.scheduledStart}
      timeOffset={timeOffset}
      isInProgress={isInProgress}
      participants={enrichedParticipants}
      errorMessage={hasError || !match ? 'no-match' : undefined}
      lang={lang}
      forcePhase={forcePhase}
    />
  );
}

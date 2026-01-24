'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MatchHero } from '@/components/features/match/match-hero';
import { RecentMatches } from '@/components/features/match/recent-matches';
import { HowToJoinSection } from '@/components/features/home';
import { useMatch } from '@/hooks/useMatch';
import { useMatchWebSocket } from '@/hooks/useMatchWebSocket';
import { useMatchActions } from '@/hooks/useMatchActions';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthStore } from '@/store/authStore';
import { matchesApi } from '@/lib/api';

interface RecentMatch {
  id: number;
  matchNumber: number;
  category: string;
  seasonNumber: number;
  playerCount: number;
  status: string;
  startedAt: string | null;
  winner: {
    id: number;
    displayName: string | null;
    totalScore: number | null;
  } | null;
}

export default function Home() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('common');
  const [wsConnected, setWsConnected] = useState(false);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [recentMatchesLoading, setRecentMatchesLoading] = useState(true);

  // Custom hooks
  const {
    nextMatch,
    setNextMatch,
    loading,
    error,
    setError,
    ongoingGameInfo,
    fetchData,
    timeOffset,
  } = useMatch();

  useMatchWebSocket({
    nextMatch,
    setNextMatch,
    setError,
    fetchData,
    wsConnected,
    setWsConnected,
  });

  const { isUserInMatch, isJoining, handleJoinClick } = useMatchActions(
    nextMatch,
    setNextMatch
  );

  usePushNotifications();

  const { isAuthenticated } = useAuthStore();

  // Fetch recent matches
  useEffect(() => {
    const fetchRecentMatches = async () => {
      try {
        const response = await matchesApi.getRecent(5);
        setRecentMatches(response.data);
      } catch (err) {
        console.error('Failed to fetch recent matches:', err);
      } finally {
        setRecentMatchesLoading(false);
      }
    };
    fetchRecentMatches();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">{t('loading')}</div>
      </div>
    );
  }

  // Show match page link if user has ongoing match
  const matchUrl = ongoingGameInfo ?
    `/${locale}/matches/${ongoingGameInfo.category}/${ongoingGameInfo.season}/${ongoingGameInfo.match}` :
    null;

  // Translate error keys
  const getErrorMessage = () => {
    if (!error && !nextMatch) return t('noUpcomingMatch');
    if (error === 'NO_UPCOMING_MATCH') return t('noUpcomingMatch');
    if (error === 'FAILED_TO_LOAD') return t('error');
    return error;
  };

  return (
    <>
      {/* Next Match Section */}
      <div>
        {error || !nextMatch ? (
          <MatchHero errorMessage={getErrorMessage()} />
        ) : (
          <MatchHero
            category={nextMatch.category || nextMatch.season?.event?.category}
            season={nextMatch.season?.seasonNumber}
            match={nextMatch.matchNumber}
            league={nextMatch.leagueType}
            currentPlayers={nextMatch.participants?.length ?? 0}
            minPlayers={nextMatch.minPlayers}
            maxPlayers={nextMatch.maxPlayers}
            scheduledStart={nextMatch.scheduledStart}
            timeOffset={timeOffset}
            onJoinClick={handleJoinClick}
            isJoined={isUserInMatch}
            isJoining={isJoining}
            matchUrl={matchUrl}
            isParticipant={isUserInMatch}
            isAuthenticated={isAuthenticated}
          />
        )}
      </div>

      {/* How to Join Section */}
      <HowToJoinSection />

      {/* Recent Matches Section */}
      <main className="py-16 bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <RecentMatches matches={recentMatches} loading={recentMatchesLoading} />
        </div>
      </main>
    </>
  );
}

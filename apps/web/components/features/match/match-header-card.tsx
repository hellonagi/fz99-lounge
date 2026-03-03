'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LEAGUE_IMAGE_MAP: Record<string, string> = {
  KNIGHT: '/leagues/knight.png',
  QUEEN: '/leagues/queen.png',
  KING: '/leagues/king.png',
  ACE: '/leagues/ace.png',
  MIRROR_KNIGHT: '/leagues/mknight.png',
  MIRROR_QUEEN: '/leagues/mqueen.png',
  MIRROR_KING: '/leagues/mking.png',
  MIRROR_ACE: '/leagues/mace.png',
};

const MODE_IMAGE_MAP: Record<string, string> = {
  MINI_PRIX: '/leagues/mini.png',
  CLASSIC_MINI_PRIX: '/leagues/cmini.png',
};

function getLeagueImage(gameMode: string, leagueType: string | null, inGameMode: string | null): string | null {
  const upper = gameMode.toUpperCase();
  if (upper === 'CLASSIC' || upper === 'TEAM_CLASSIC') {
    return '/leagues/cmini.png';
  }
  if (leagueType && LEAGUE_IMAGE_MAP[leagueType]) {
    return LEAGUE_IMAGE_MAP[leagueType];
  }
  if (inGameMode && MODE_IMAGE_MAP[inGameMode]) {
    return MODE_IMAGE_MAP[inGameMode];
  }
  return null;
}

interface MatchHeaderCardProps {
  gameMode: string;
  seasonNumber: number | null;
  gameNumber: number | null;
  leagueType: string | null;
  inGameMode?: string | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
}

export function MatchHeaderCard(props: MatchHeaderCardProps) {
  const { gameMode, seasonNumber, gameNumber, leagueType, inGameMode, startedAt, status } = props;
  // Format time as HH:MM
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  // Format date as YYYY/MM/DD
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  // Determine if match is live
  const isLive = status === 'IN_PROGRESS';

  const formatWords = (str: string) =>
    str.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

  const formatLeagueDisplay = () => {
    const modePart = inGameMode ? formatWords(inGameMode) : formatWords(gameMode);
    if (leagueType) {
      return `${modePart} - ${formatWords(leagueType)} League`;
    }
    return modePart;
  };

  const leagueImage = getLeagueImage(gameMode, leagueType, inGameMode ?? null);

  return (
    <Card showGradient>
      <CardContent className="relative text-center p-8 overflow-hidden">
        {leagueImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Image
              src={leagueImage}
              alt=""
              width={280}
              height={280}
              className="opacity-[0.08] select-none"
            />
          </div>
        )}
        <div className="relative">
          {/* Time */}
          <div className="text-5xl md:text-6xl font-black text-white mb-2">
            {formatTime(startedAt)}
          </div>

          {/* Date */}
          <div className="text-xl text-gray-400 mb-6">
            {formatDate(startedAt)}
          </div>

          {/* Season Game */}
          <div className="text-2xl md:text-3xl font-bold text-white mb-2">
            Season {seasonNumber} #{gameNumber}
          </div>

          {/* League */}
          <div className="text-lg text-gray-300 mb-4">
            {formatLeagueDisplay()}
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge
              variant={isLive ? 'default' : 'secondary'}
              className={isLive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 hover:bg-gray-700'}
            >
              {isLive ? 'Live' : 'Match over'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

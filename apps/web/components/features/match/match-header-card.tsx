'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MatchHeaderCardProps {
  gameMode: string;
  seasonNumber: number | null;
  gameNumber: number | null;
  leagueType: string | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
}

export function MatchHeaderCard(props: MatchHeaderCardProps) {
  const { gameMode, seasonNumber, gameNumber, leagueType, startedAt, status } = props;
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

  // Format league type for display
  const formatLeagueDisplay = (league: string | null, mode: string) => {
    if (!league) {
      // CLASSICモードはリーグ選択なし
      return 'Classic';
    }
    if (mode?.toLowerCase() === 'classic') {
      // CLASSIC_MINI -> Classic Mini Prix
      return league
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ') + ' Prix';
    }
    return `${league} League`;
  };

  return (
    <Card showGradient>
      <CardContent className="text-center p-8">
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
          {formatLeagueDisplay(leagueType, gameMode)}
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
      </CardContent>
    </Card>
  );
}

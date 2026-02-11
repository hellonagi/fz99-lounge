'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TeamMember {
  userId: number;
  displayName: string | null;
  totalScore: number | null;
  ratingChange: number | null;
}

interface TeamScore {
  teamIndex: number;
  score: number;
  rank: number;
}

interface TeamResultsGridProps {
  teams: Array<{
    teamIndex: number;
    teamNumber: number;
    color: string;
    colorHex: string;
    members: TeamMember[];
  }>;
  teamScores: TeamScore[];
  excludedUsers?: TeamMember[];
}

// Team color hex values
const TEAM_COLOR_HEX: Record<number, string> = {
  1: '#EF4444', // Red
  2: '#3B82F6', // Blue
  3: '#22C55E', // Green
  4: '#EAB308', // Yellow
  5: '#A855F7', // Purple
  6: '#F97316', // Orange
  7: '#06B6D4', // Cyan
  8: '#EC4899', // Pink
  9: '#F5F5F5', // White
  10: '#6B7280', // Black
};

const TEAM_COLORS: Record<number, string> = {
  1: 'Red',
  2: 'Blue',
  3: 'Green',
  4: 'Yellow',
  5: 'Purple',
  6: 'Orange',
  7: 'Cyan',
  8: 'Pink',
  9: 'White',
  10: 'Black',
};

export function TeamResultsGrid({
  teams,
  teamScores,
  excludedUsers,
}: TeamResultsGridProps) {
  const t = useTranslations('teamClassic');

  // Sort teams by rank
  const sortedTeams = [...teams].sort((a, b) => {
    const aScore = teamScores.find((ts) => ts.teamIndex === a.teamIndex);
    const bScore = teamScores.find((ts) => ts.teamIndex === b.teamIndex);
    return (aScore?.rank || 999) - (bScore?.rank || 999);
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-black';
    if (rank === 2) return 'bg-gray-400 text-black';
    if (rank === 3) return 'bg-amber-600 text-white';
    return 'bg-gray-700 text-white';
  };

  return (
    <div className="space-y-4">
      {/* Team Results Header */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white">{t('teamResults')}</h3>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedTeams.map((team) => {
          const teamScore = teamScores.find(
            (ts) => ts.teamIndex === team.teamIndex
          );
          const rank = teamScore?.rank || 0;
          const score = teamScore?.score || 0;
          const colorHex =
            team.colorHex || TEAM_COLOR_HEX[team.teamNumber] || '#808080';
          const colorName =
            team.color || TEAM_COLORS[team.teamNumber] || 'Unknown';

          return (
            <Card
              key={team.teamIndex}
              className={`border-2 ${rank === 1 ? 'ring-2 ring-yellow-400' : ''}`}
              style={{ borderColor: colorHex }}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getRankIcon(rank)}
                    <span style={{ color: colorHex }}>
                      Team {String.fromCharCode(65 + team.teamIndex)}
                    </span>
                  </div>
                  <Badge className={getRankBadgeStyle(rank)}>
                    #{rank}
                  </Badge>
                </CardTitle>
                <div className="text-xs text-gray-400">{colorName}</div>
              </CardHeader>
              <CardContent>
                {/* Team Score */}
                <div
                  className="text-3xl font-bold text-center mb-4"
                  style={{ color: colorHex }}
                >
                  {score.toLocaleString()}
                  <span className="text-sm text-gray-400 ml-1">pts</span>
                </div>

                {/* Team Members */}
                <div className="space-y-2">
                  {team.members
                    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
                    .map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between text-sm py-1 border-b border-gray-700 last:border-0"
                      >
                        <span className="text-gray-300 truncate max-w-[120px]">
                          {member.displayName || 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono">
                            {member.totalScore?.toLocaleString() || '0'}
                          </span>
                          {member.ratingChange !== null && (
                            <span
                              className={`text-xs ${
                                member.ratingChange > 0
                                  ? 'text-green-400'
                                  : member.ratingChange < 0
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                              }`}
                            >
                              {member.ratingChange > 0 ? '+' : ''}
                              {member.ratingChange}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Excluded Players */}
      {excludedUsers && excludedUsers.length > 0 && (
        <Card className="border-gray-600">
          <CardHeader>
            <CardTitle className="text-gray-400 text-sm">
              {t('excludedPlayers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {excludedUsers.map((user) => (
                <Badge key={user.userId} variant="outline" className="text-gray-400">
                  {user.displayName || 'Unknown'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

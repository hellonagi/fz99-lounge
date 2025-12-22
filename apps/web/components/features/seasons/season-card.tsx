'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Gamepad2, Users, Trophy } from 'lucide-react';

interface SeasonCardProps {
  season: {
    id: number;
    seasonNumber: number;
    description: string | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    event: {
      category: 'GP' | 'CLASSIC' | 'TOURNAMENT';
      name: string;
    };
  };
  matchCount?: number;
  participantCount?: number;
  onManage?: () => void;
}

export function SeasonCard({ season, matchCount = 0, participantCount = 0, onManage }: SeasonCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSeasonStatus = () => {
    const now = new Date();
    const startDate = new Date(season.startDate);
    const endDate = season.endDate ? new Date(season.endDate) : null;

    if (!season.isActive) {
      return { label: '非アクティブ', variant: 'secondary' as const, color: 'text-gray-400' };
    }

    if (now < startDate) {
      return { label: '予定', variant: 'default' as const, color: 'text-blue-400' };
    }

    if (endDate && now > endDate) {
      return { label: '終了', variant: 'destructive' as const, color: 'text-red-400' };
    }

    return { label: 'アクティブ', variant: 'success' as const, color: 'text-green-400' };
  };

  const status = getSeasonStatus();
  const maxPlayers = season.event.category === 'GP' ? 99 : 20;

  return (
    <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              {season.event.name}
            </CardTitle>
            <div className="flex gap-2 mt-2">
              <Badge variant={status.variant}>
                {status.label}
              </Badge>
              <Badge variant="outline" className="text-gray-300">
                {season.event.category} ({maxPlayers}人)
              </Badge>
            </div>
          </div>
          <div className={`text-2xl font-bold ${status.color}`}>
            #{season.seasonNumber}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {season.description && (
          <p className="text-gray-400 text-sm italic">
            {season.description}
          </p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span>開始: {formatDate(season.startDate)}</span>
          </div>
          {season.endDate && (
            <div className="flex items-center gap-2 text-gray-300">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>終了: {formatDate(season.endDate)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Trophy className="h-3 w-3" />
              <span>マッチ数</span>
            </div>
            <p className="text-white text-xl font-bold">{matchCount}</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Users className="h-3 w-3" />
              <span>参加者数</span>
            </div>
            <p className="text-white text-xl font-bold">{participantCount}</p>
          </div>
        </div>

        {onManage && (
          <Button
            onClick={onManage}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            管理
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

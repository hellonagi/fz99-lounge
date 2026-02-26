'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Gamepad2, Edit2, Power, Trash2, AlertCircle } from 'lucide-react';
import { seasonsApi } from '@/lib/api';
import { EditSeasonDialog } from './edit-season-dialog';

interface Season {
  id: number;
  eventId: number;
  seasonNumber: number;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  event: {
    id: number;
    category: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP' | 'TOURNAMENT';
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

interface SeasonsListProps {
  refreshTrigger?: number;
}

export function SeasonsList({ refreshTrigger }: SeasonsListProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP'>('ALL');
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await seasonsApi.getAll();
      setSeasons(response.data || []);
    } catch (err: unknown) {
      console.error('Error fetching seasons:', err);
      setError('シーズンの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, [refreshTrigger]);

  const handleToggleStatus = async (seasonId: number, currentStatus: boolean) => {
    try {
      // Toggle the active status
      await seasonsApi.toggleStatus(seasonId, {
        isActive: !currentStatus,
      });
      // Refresh the list
      await fetchSeasons();
    } catch (err: unknown) {
      console.error('Error toggling season status:', err);
      alert('ステータスの変更に失敗しました');
    }
  };

  const handleDelete = async (seasonId: number) => {
    if (!confirm('本当にこのシーズンを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      await seasonsApi.delete(seasonId);
      await fetchSeasons();
    } catch (err: unknown) {
      console.error('Error deleting season:', err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      alert(axiosError.response?.data?.message || 'シーズンの削除に失敗しました');
    }
  };

  const filteredSeasons = seasons.filter(season => {
    if (filter === 'ALL') return true;
    return season.event.category === filter;
  });

  const getSeasonStatus = (season: Season) => {
    const now = new Date();
    const startDate = new Date(season.startDate);
    const endDate = season.endDate ? new Date(season.endDate) : null;

    if (!season.isActive) {
      return { label: '非アクティブ', variant: 'secondary' as const };
    }

    if (now < startDate) {
      return { label: '予定', variant: 'default' as const };
    }

    if (endDate && now > endDate) {
      return { label: '終了', variant: 'destructive' as const };
    }

    return { label: 'アクティブ', variant: 'success' as const };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <span className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-8">
          <div className="text-center text-red-400 flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8" />
            <span>{error}</span>
            <Button onClick={fetchSeasons} variant="outline" size="sm" className="mt-2">
              再試行
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                シーズン一覧
              </CardTitle>
              <CardDescription className="text-gray-400">
                現在のシーズンを管理します
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('ALL')}
                className={filter === 'ALL' ? 'bg-blue-600' : ''}
              >
                全て
              </Button>
              <Button
                variant={filter === 'GP' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('GP')}
                className={filter === 'GP' ? 'bg-blue-600' : ''}
              >
                GP
              </Button>
              <Button
                variant={filter === 'CLASSIC' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('CLASSIC')}
                className={filter === 'CLASSIC' ? 'bg-blue-600' : ''}
              >
                CLASSIC
              </Button>
              <Button
                variant={filter === 'TEAM_CLASSIC' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('TEAM_CLASSIC')}
                className={filter === 'TEAM_CLASSIC' ? 'bg-blue-600' : ''}
              >
                TEAM CLASSIC
              </Button>
              <Button
                variant={filter === 'TEAM_GP' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('TEAM_GP')}
                className={filter === 'TEAM_GP' ? 'bg-blue-600' : ''}
              >
                TEAM GP
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSeasons.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>シーズンが見つかりません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSeasons.map(season => {
                const status = getSeasonStatus(season);
                return (
                  <div
                    key={season.id}
                    className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-semibold">
                          {season.event.name}
                        </h3>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                        <Badge variant="outline" className="text-gray-300">
                          {season.event.category}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>シーズン番号: {season.seasonNumber}</p>
                        <p>開始: {formatDate(season.startDate)}</p>
                        {season.endDate && (
                          <p>終了: {formatDate(season.endDate)}</p>
                        )}
                        {season.description && (
                          <p className="italic">{season.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingSeasonId(season.id)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(season.id, season.isActive)}
                        className={season.isActive ? "text-green-400 hover:text-green-300" : "text-gray-400 hover:text-white"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(season.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editingSeasonId && (
        <EditSeasonDialog
          seasonId={editingSeasonId}
          isOpen={!!editingSeasonId}
          onClose={() => setEditingSeasonId(null)}
          onSuccess={() => {
            setEditingSeasonId(null);
            fetchSeasons();
          }}
        />
      )}
    </>
  );
}
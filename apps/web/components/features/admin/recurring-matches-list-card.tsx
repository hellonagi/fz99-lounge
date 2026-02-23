'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';
import { recurringMatchesApi } from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import type { RecurringMatch } from '@/types';

interface RecurringMatchesListCardProps {
  schedules: RecurringMatch[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (schedule: RecurringMatch) => void;
  editingId: number | null;
}

export function RecurringMatchesListCard({
  schedules,
  loading,
  onRefresh,
  onEdit,
  editingId,
}: RecurringMatchesListCardProps) {
  const t = useTranslations('recurringMatch');

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await recurringMatchesApi.toggle(id, enabled);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await recurringMatchesApi.delete(id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const formatDays = (daysOfWeek: number[]) => {
    const sorted = [...daysOfWeek].sort((a, b) => {
      const order = [1, 2, 3, 4, 5, 6, 0];
      return order.indexOf(a) - order.indexOf(b);
    });
    return sorted.map((d) => t(`dayNames.${d}`)).join(', ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            {t('noSchedules')}
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  editingId === schedule.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/50">
                      {schedule.eventCategory === 'TEAM_CLASSIC'
                        ? 'TEAM CLASSIC'
                        : schedule.eventCategory}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {schedule.rules.map((rule) => (
                      <div key={rule.id} className="text-xs text-gray-400">
                        {formatDays(rule.daysOfWeek)} / {rule.timeOfDay} JST
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {schedule.minPlayers}-{schedule.maxPlayers}p
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(schedule)}
                    className="text-gray-400 hover:text-white hover:bg-gray-700 h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={schedule.isEnabled}
                    onCheckedChange={(checked) => handleToggle(schedule.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(schedule.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

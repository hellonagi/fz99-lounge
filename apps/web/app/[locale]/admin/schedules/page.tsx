'use client';

import { useState, useEffect, useCallback } from 'react';
import { recurringMatchesApi } from '@/lib/api';
import { RecurringMatchFormCard } from '@/components/features/admin/recurring-match-form-card';
import { RecurringMatchesListCard } from '@/components/features/admin/recurring-matches-list-card';
import { ScheduleWeeklyGrid } from '@/components/features/admin/schedule-weekly-grid';
import type { RecurringMatch } from '@/types';

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<RecurringMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<RecurringMatch | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const response = await recurringMatchesApi.getAll();
      setSchedules(response.data);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSuccess = () => {
    setEditingSchedule(null);
    fetchSchedules();
  };

  return (
    <div className="space-y-6">
      <ScheduleWeeklyGrid schedules={schedules} />
      <RecurringMatchFormCard
        schedule={editingSchedule}
        onSuccess={handleSuccess}
        onCancelEdit={() => setEditingSchedule(null)}
      />
      <RecurringMatchesListCard
        schedules={schedules}
        loading={loading}
        onRefresh={fetchSchedules}
        onEdit={setEditingSchedule}
        editingId={editingSchedule?.id ?? null}
      />
    </div>
  );
}

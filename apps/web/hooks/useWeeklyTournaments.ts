import { useState, useEffect, useCallback, useMemo } from 'react';
import { tournamentsApi } from '@/lib/api';

export interface WeeklyTournament {
  id: number;
  name: string;
  tournamentNumber: number;
  status: string;
  tournamentDate: string;
  registrationStart: string;
  registrationEnd: string;
  totalRounds: number;
  minPlayers: number;
  maxPlayers: number;
  registrationCount: number;
}

/** Get 7-day range starting from today in local timezone */
function getCurrentWeekRangeLocal(): { from: string; to: string } {
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endLocal = new Date(todayLocal.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    from: todayLocal.toISOString(),
    to: endLocal.toISOString(),
  };
}

export function useWeeklyTournaments() {
  const [tournaments, setTournaments] = useState<WeeklyTournament[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => getCurrentWeekRangeLocal(), []);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await tournamentsApi.getWeek(from, to);
      setTournaments(response.data);
    } catch (err) {
      console.error('Failed to fetch weekly tournaments:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  return { tournaments, loading };
}

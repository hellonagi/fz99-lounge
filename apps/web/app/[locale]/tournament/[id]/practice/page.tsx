'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { tournamentsApi } from '@/lib/api';
import type { Tournament } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TournamentRoundsTab } from '@/components/features/tournament/tournament-rounds-tab';
import { useTournament } from '../tournament-context';

function PracticeBanner() {
  const t = useTranslations('tournament');
  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <AlertDescription>{t('practiceBanner')}</AlertDescription>
    </Alert>
  );
}

export default function PracticePage() {
  const { tournament: parentTournament } = useTournament();
  const t = useTranslations('tournament');

  const [practiceTournament, setPracticeTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep latest tournament in a ref so fetchPractice stays stable across refetches
  const practiceRef = useRef<Tournament | null>(null);
  practiceRef.current = practiceTournament;

  const fetchPractice = useCallback(async () => {
    try {
      const res = await tournamentsApi.getPractice(parentTournament.id);
      setPracticeTournament(res.data);
    } catch {
      if (!practiceRef.current) setError(t('error'));
    }
  }, [parentTournament.id, t]);

  useEffect(() => {
    setLoading(true);
    fetchPractice().finally(() => setLoading(false));
  }, [fetchPractice]);

  if (loading) {
    return (
      <div className="space-y-4">
        <PracticeBanner />
        <div className="text-gray-400">{t('loading')}</div>
      </div>
    );
  }

  if (error || !practiceTournament) {
    return (
      <div className="space-y-4">
        <PracticeBanner />
        <div className="text-red-400">{error || t('notFound')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PracticeBanner />
      <TournamentRoundsTab tournament={practiceTournament} onUpdate={fetchPractice} />
    </div>
  );
}

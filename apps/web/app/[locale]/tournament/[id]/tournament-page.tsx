'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { tournamentsApi } from '@/lib/api';
import { Tournament } from '@/types';
import { TournamentDetail } from '@/components/features/tournament/tournament-detail';

export default function TournamentPage() {
  const params = useParams();
  const id = Number(params.id);
  const t = useTranslations('tournament');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const res = await tournamentsApi.getById(id);
      setTournament(res.data);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTournament();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-gray-400">{t('loading')}</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-red-400">{error || t('notFound')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <TournamentDetail tournament={tournament} onUpdate={fetchTournament} />
    </div>
  );
}

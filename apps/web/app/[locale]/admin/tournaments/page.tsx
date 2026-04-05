'use client';

import { useState } from 'react';
import { CreateTournamentForm } from '@/components/features/admin/create-tournament-form';
import { TournamentsList } from '@/components/features/admin/tournaments-list';

export default function AdminTournamentsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <CreateTournamentForm onCreated={() => setRefreshKey((k) => k + 1)} />
      <TournamentsList refreshKey={refreshKey} />
    </div>
  );
}

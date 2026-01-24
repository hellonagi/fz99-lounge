'use client';

import { CreateMatchCard } from '@/components/features/admin/create-match-card';
import { MatchesListCard } from '@/components/features/admin/matches-list-card';

export default function AdminMatchesPage() {
  return (
    <div className="space-y-6">
      <CreateMatchCard />
      <MatchesListCard />
    </div>
  );
}

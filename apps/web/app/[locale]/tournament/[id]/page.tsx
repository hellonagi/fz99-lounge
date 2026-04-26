'use client';

import { TournamentOverview } from '@/components/features/tournament/tournament-detail';
import { useTournament } from './tournament-context';

export default function Page() {
  const { tournament, onUpdate } = useTournament();
  return <TournamentOverview tournament={tournament} onUpdate={onUpdate} />;
}

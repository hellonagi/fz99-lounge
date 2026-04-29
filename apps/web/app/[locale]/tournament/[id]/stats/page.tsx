'use client';

import { TournamentStats } from '@/components/features/tournament/tournament-stats';
import { useTournament } from '../tournament-context';

export default function StatsPage() {
  const { tournament } = useTournament();
  return <TournamentStats tournament={tournament} />;
}

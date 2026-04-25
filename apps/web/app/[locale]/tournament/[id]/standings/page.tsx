'use client';

import { TournamentStandingsTab } from '@/components/features/tournament/tournament-standings-tab';
import { useTournament } from '../tournament-context';

export default function StandingsPage() {
  const { tournament } = useTournament();
  return <TournamentStandingsTab tournament={tournament} />;
}

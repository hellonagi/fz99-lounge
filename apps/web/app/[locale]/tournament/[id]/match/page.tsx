'use client';

import { TournamentRoundsTab } from '@/components/features/tournament/tournament-rounds-tab';
import { useTournament } from '../tournament-context';

export default function MatchPage() {
  const { tournament, onUpdate } = useTournament();
  return <TournamentRoundsTab tournament={tournament} onUpdate={onUpdate} />;
}

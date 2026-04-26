'use client';

import { createContext, useContext } from 'react';
import type { Tournament } from '@/types';

interface TournamentContextValue {
  tournament: Tournament;
  onUpdate: () => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({
  tournament,
  onUpdate,
  children,
}: TournamentContextValue & { children: React.ReactNode }) {
  return (
    <TournamentContext.Provider value={{ tournament, onUpdate }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}

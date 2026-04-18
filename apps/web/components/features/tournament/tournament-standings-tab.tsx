'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Tournament, Match, GameParticipant } from '@/types';

interface TournamentStandingsTabProps {
  tournament: Tournament;
}

interface PlayerStanding {
  userId: number;
  displayName: string;
  profileNumber?: number;
  country?: string;
  roundScores: Record<number, number | null>;
  total: number;
}

export function TournamentStandingsTab({ tournament }: TournamentStandingsTabProps) {
  const t = useTranslations('tournament');

  const matches = tournament.season?.matches || [];
  const rounds = tournament.rounds;

  const standings = useMemo(() => {
    const playerMap = new Map<number, PlayerStanding>();

    for (const match of matches) {
      const roundNumber = match.matchNumber;
      if (roundNumber == null) continue;

      const game = match.games?.[0];
      if (!game?.participants) continue;

      for (const p of game.participants) {
        if (p.status === 'UNSUBMITTED') continue;

        let standing = playerMap.get(p.userId);
        if (!standing) {
          standing = {
            userId: p.userId,
            displayName: p.user?.displayName || `Player ${p.userId}`,
            profileNumber: p.user?.profileNumber,
            roundScores: {},
            total: 0,
          };
          playerMap.set(p.userId, standing);
        }

        const score = p.totalScore ?? 0;
        standing.roundScores[roundNumber] = score;
        standing.total += score;
      }
    }

    return Array.from(playerMap.values()).sort((a, b) => b.total - a.total);
  }, [matches]);

  if (standings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-400 text-sm">{t('standings.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 text-left text-gray-400">
                <th className="px-2 py-1.5 w-8">{t('standings.rank')}</th>
                <th className="px-2 py-1.5">{t('standings.player')}</th>
                {rounds.map((r) => (
                  <th key={r.roundNumber} className="px-2 py-1.5 text-right whitespace-nowrap">
                    {t('standings.roundPrefix')}{r.roundNumber}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-bold">{t('standings.total')}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const rank = i === 0 || s.total < standings[i - 1].total ? i + 1 : i;
                return (
                  <tr
                    key={s.userId}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30"
                  >
                    <td className="px-2 py-1.5 text-gray-400">{rank}</td>
                    <td className="px-2 py-1.5">
                      {s.profileNumber ? (
                        <Link
                          href={`/profile/${s.profileNumber}`}
                          className="text-gray-300 hover:text-white hover:underline"
                        >
                          {s.displayName}
                        </Link>
                      ) : (
                        <span className="text-gray-300">{s.displayName}</span>
                      )}
                    </td>
                    {rounds.map((r) => (
                      <td
                        key={r.roundNumber}
                        className="px-2 py-1.5 text-right font-mono text-gray-300"
                      >
                        {s.roundScores[r.roundNumber] != null
                          ? s.roundScores[r.roundNumber]
                          : '-'}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-white">
                      {s.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

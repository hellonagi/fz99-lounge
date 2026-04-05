'use client';

import Link from 'next/link';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { Trophy, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { WeeklyTournament } from '@/hooks/useWeeklyTournaments';

interface TournamentBannerProps {
  tournaments: WeeklyTournament[];
}

function TournamentBannerItem({ tournament }: { tournament: WeeklyTournament }) {
  const t = useTranslations('tournament');
  const format = useFormatter();
  const locale = useLocale();

  const dateStr = format.dateTime(new Date(tournament.tournamentDate), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      href={`/${locale}/tournament/${tournament.id}`}
      className="group block rounded-lg border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm p-4 transition-colors hover:bg-amber-500/10"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                {t('banner.entryOpen')}
              </span>
            </div>
            <p className="text-sm font-medium text-white truncate mt-0.5">
              {tournament.name}
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
              <span>{dateStr}</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {t('participantCount', {
                  count: tournament.registrationCount,
                  max: tournament.maxPlayers,
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              buttonVariants({ size: 'sm' }),
              'bg-amber-600 text-white hover:bg-amber-700 gap-1',
            )}
          >
            {t('banner.entry')}
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function TournamentBanner({ tournaments }: TournamentBannerProps) {
  if (tournaments.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto mt-12">
      <div className="space-y-3">
        {tournaments.map((tournament) => (
          <TournamentBannerItem key={tournament.id} tournament={tournament} />
        ))}
      </div>
    </div>
  );
}

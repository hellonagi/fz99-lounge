'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Season {
  id: number;
  seasonNumber: number;
  isActive: boolean;
}

interface SeasonSelectProps {
  seasons: Season[];
  selectedSeasonNumber: number | undefined;
  onSeasonChange: (seasonNumber: number) => void;
}

export function SeasonSelect({
  seasons,
  selectedSeasonNumber,
  onSeasonChange,
}: SeasonSelectProps) {
  const tCommon = useTranslations('common');

  // Separate Unrated (seasonNumber=0) and regular seasons
  const regularSeasons = seasons
    .filter((s) => s.seasonNumber !== -1)
    .sort((a, b) => b.seasonNumber - a.seasonNumber);
  const unratedSeason = seasons.find((s) => s.seasonNumber === -1);

  return (
    <Select
      value={selectedSeasonNumber?.toString()}
      onValueChange={(value) => onSeasonChange(parseInt(value, 10))}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Season" />
      </SelectTrigger>
      <SelectContent>
        {regularSeasons.map((season) => (
          <SelectItem key={season.id} value={season.seasonNumber.toString()}>
            Season {season.seasonNumber}
            {season.isActive && (
              <span className="ml-2 text-xs text-green-400">(Current)</span>
            )}
          </SelectItem>
        ))}
        {unratedSeason && (
          <SelectItem key={unratedSeason.id} value="-1">
            {tCommon('unrated')}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

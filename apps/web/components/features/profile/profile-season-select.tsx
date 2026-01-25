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

interface ProfileSeasonSelectProps {
  seasons: Season[];
  selectedSeasonNumber: number | undefined;
  onSeasonChange: (seasonNumber: number) => void;
}

export function ProfileSeasonSelect({
  seasons,
  selectedSeasonNumber,
  onSeasonChange,
}: ProfileSeasonSelectProps) {
  const t = useTranslations('profile');

  // Sort by seasonNumber descending (newest first)
  const sortedSeasons = [...seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);

  if (seasons.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedSeasonNumber?.toString()}
      onValueChange={(value) => onSeasonChange(parseInt(value, 10))}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={t('selectSeason')} />
      </SelectTrigger>
      <SelectContent>
        {sortedSeasons.map((season) => (
          <SelectItem key={season.id} value={season.seasonNumber.toString()}>
            Season {season.seasonNumber}
            {season.isActive && (
              <span className="ml-2 text-xs text-green-400">{t('currentSeason')}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

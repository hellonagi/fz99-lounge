'use client';

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
  // Sort by seasonNumber descending (newest first)
  const sortedSeasons = [...seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);

  return (
    <Select
      value={selectedSeasonNumber?.toString()}
      onValueChange={(value) => onSeasonChange(parseInt(value, 10))}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Season" />
      </SelectTrigger>
      <SelectContent>
        {sortedSeasons.map((season) => (
          <SelectItem key={season.id} value={season.seasonNumber.toString()}>
            Season {season.seasonNumber}
            {season.isActive && (
              <span className="ml-2 text-xs text-green-400">(Current)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

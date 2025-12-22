import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const MACHINE_COLORS: Record<string, string> = {
  'Blue Falcon': 'text-blue-400',
  'Golden Fox': 'text-yellow-400',
  'Wild Goose': 'text-green-400',
  'Fire Stingray': 'text-red-400',
};

const MACHINE_SHORT: Record<string, string> = {
  'Blue Falcon': 'BF',
  'Golden Fox': 'GF',
  'Wild Goose': 'WG',
  'Fire Stingray': 'FS',
};

interface MatchResultRowProps {
  position?: number | null;
  displayName: string | null;
  profileId: number;
  country?: string | null;
  machine: string;
  assistEnabled: boolean;
  totalScore?: number | null;
  eliminatedAtRace?: number | null;
}

export function MatchResultRow({
  position,
  displayName,
  profileId,
  country,
  machine,
  assistEnabled,
  totalScore,
  eliminatedAtRace,
}: MatchResultRowProps) {
  const positionColor = position
    ? position <= 3
      ? 'text-yellow-400'
      : position <= 10
        ? 'text-gray-300'
        : 'text-gray-400'
    : 'text-gray-500';

  const shortMachine = MACHINE_SHORT[machine] || machine;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg">
      {/* Position */}
      <div className="flex-shrink-0 w-7 text-left">
        {position ? (
          <span className={cn('text-sm font-bold', positionColor)}>
            #{position}
          </span>
        ) : (
          <span className="text-gray-500 text-sm">-</span>
        )}
      </div>

      {/* Country */}
      <div className="flex-shrink-0 w-5">
        {country && (
          <span className={`fi fi-${country.toLowerCase()}`} title={country} />
        )}
      </div>

      {/* Name */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-white font-medium text-sm truncate">
          {displayName || `User#${profileId}`}
        </span>
        {assistEnabled && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-400 border-blue-400/50 bg-blue-900/50 flex-shrink-0">
            A
          </Badge>
        )}
      </div>

      {/* Machine - fixed width for alignment */}
      <span className={cn('text-xs flex-shrink-0 w-6 text-center font-mono sm:hidden', MACHINE_COLORS[machine] || 'text-gray-400')}>
        {shortMachine}
      </span>
      <span className={cn('text-xs flex-shrink-0 hidden sm:inline sm:w-24', MACHINE_COLORS[machine] || 'text-gray-400')}>
        {machine}
      </span>

      {/* Points or DNF */}
      <div className="flex-shrink-0 w-16 text-right">
        {eliminatedAtRace !== null && eliminatedAtRace !== undefined ? (
          <span className="text-red-400 font-bold text-sm whitespace-nowrap">DNF R{eliminatedAtRace}</span>
        ) : totalScore !== null && totalScore !== undefined ? (
          <span className="text-white font-bold text-sm whitespace-nowrap">{totalScore} pts</span>
        ) : (
          <span className="text-gray-500 text-sm">-</span>
        )}
      </div>
    </div>
  );
}

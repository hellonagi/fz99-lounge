import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const MACHINE_COLORS: Record<string, string> = {
  'Blue Falcon': 'text-blue-400',
  'Golden Fox': 'text-yellow-400',
  'Wild Goose': 'text-green-400',
  'Fire Stingray': 'text-red-400',
};

interface MatchResultRowProps {
  position?: number | null;
  displayName: string | null;
  profileId: number;
  machine: string;
  assistEnabled: boolean;
  reportedPoints: number | null;
}

export function MatchResultRow({
  position,
  displayName,
  profileId,
  machine,
  assistEnabled,
  reportedPoints,
}: MatchResultRowProps) {
  const positionColor = position
    ? position <= 3
      ? 'text-yellow-400'
      : position <= 10
        ? 'text-gray-300'
        : 'text-gray-400'
    : 'text-gray-500';

  return (
    <div className="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
      <div className="flex items-center space-x-4">
        {/* Position */}
        <div className="text-center min-w-[40px]">
          {position ? (
            <span className={cn('text-lg font-bold', positionColor)}>
              #{position}
            </span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </div>

        {/* Player Name */}
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">
            {displayName || `User#${profileId}`}
          </span>
          {assistEnabled && (
            <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/50 bg-blue-900/50">
              ASSIST
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Machine */}
        <span className={cn('text-sm', MACHINE_COLORS[machine] || 'text-gray-400')}>
          {machine}
        </span>

        {/* Points */}
        <div className="text-right min-w-[80px]">
          {reportedPoints !== null ? (
            <span className="text-yellow-400 font-bold">{reportedPoints} pts</span>
          ) : (
            <span className="text-gray-500">No score</span>
          )}
        </div>
      </div>
    </div>
  );
}

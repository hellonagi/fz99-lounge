import { cn } from '@/lib/utils';

interface TotalEntry {
  user: {
    id: string;
    profileId: number;
    displayName: string | null;
  };
  totalPoints: number;
  gamesPlayed: number;
}

interface MatchTotalRankingProps {
  entries: TotalEntry[];
  totalGames?: number;
  emptyMessage?: string;
}

export function MatchTotalRanking({
  entries,
  totalGames = 3,
  emptyMessage = 'No results yet',
}: MatchTotalRankingProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const rankColor =
          index === 0
            ? 'text-yellow-400'
            : index === 1
              ? 'text-gray-300'
              : index === 2
                ? 'text-orange-400'
                : 'text-gray-400';

        return (
          <div
            key={entry.user.id}
            className="flex justify-between items-center p-4 bg-gray-700 rounded-lg"
          >
            <div className="flex items-center space-x-4">
              {/* Rank */}
              <div className="text-center min-w-[40px]">
                <span className={cn('text-lg font-bold', rankColor)}>
                  #{index + 1}
                </span>
              </div>

              {/* Player Name */}
              <div>
                <span className="text-white font-medium">
                  {entry.user.displayName || `User#${entry.user.profileId}`}
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  ({entry.gamesPlayed}/{totalGames} games)
                </span>
              </div>
            </div>

            {/* Total Points */}
            <div className="text-right">
              <span className="text-2xl text-yellow-400 font-bold">
                {entry.totalPoints} pts
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

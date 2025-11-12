interface StatsGridProps {
  totalMatches?: number;
  wins?: number;
  winRate?: number;
  avgPosition?: number;
}

export function StatsGrid({
  totalMatches = 0,
  wins = 0,
  winRate = 0,
  avgPosition,
}: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-white">{totalMatches}</div>
        <div className="text-xs text-gray-400">Total Matches</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-green-400">{wins}</div>
        <div className="text-xs text-gray-400">Wins</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-blue-400">{winRate.toFixed(1)}%</div>
        <div className="text-xs text-gray-400">Win Rate</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold text-purple-400">
          {avgPosition !== undefined ? avgPosition.toFixed(1) : '-'}
        </div>
        <div className="text-xs text-gray-400">Avg Position</div>
      </div>
    </div>
  );
}

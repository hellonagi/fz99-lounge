interface SeasonStatsProps {
  league?: string;
  mmr?: number;
  rank?: number;
}

export function SeasonStats({ league, mmr, rank }: SeasonStatsProps) {
  return (
    <div className="bg-gray-800 shadow-lg overflow-hidden sm:rounded-md">
      <div className="px-4 py-3 sm:px-6 border-b border-gray-700">
        <h3 className="text-lg font-medium text-gray-100">Season Stats</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">League</span>
          <span className="text-sm font-medium text-white">{league || '-'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">MMR</span>
          <span className="text-sm font-medium text-white">{mmr || '-'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Rank</span>
          <span className="text-sm font-medium text-white">{rank ? `#${rank}` : '-'}</span>
        </div>
      </div>
    </div>
  );
}

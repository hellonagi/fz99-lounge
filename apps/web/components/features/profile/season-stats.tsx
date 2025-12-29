import { UserSeasonStats } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRankInfo, RANK_THRESHOLDS } from '@/lib/rank-utils';
import { cn } from '@/lib/utils';

interface SeasonStatsProps {
  stats?: UserSeasonStats;
}

export function SeasonStats({ stats }: SeasonStatsProps) {
  if (!stats) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Season Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">No season data</div>
        </CardContent>
      </Card>
    );
  }

  const rankInfo = getRankInfo(stats.displayRating);

  // Calculate progress to next rank
  const currentThresholdIndex = RANK_THRESHOLDS.findIndex((t) => stats.displayRating >= t.rating);
  const currentThreshold = RANK_THRESHOLDS[currentThresholdIndex];
  const nextThreshold = RANK_THRESHOLDS[currentThresholdIndex - 1];

  let progress = 100;
  let pointsToNext = 0;
  if (nextThreshold) {
    const rangeSize = nextThreshold.rating - currentThreshold.rating;
    const currentProgress = stats.displayRating - currentThreshold.rating;
    progress = Math.min(100, (currentProgress / rangeSize) * 100);
    pointsToNext = nextThreshold.rating - stats.displayRating;
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Season Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rank Display */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded-full', rankInfo.color)} />
              <span className="text-lg font-bold text-white">{rankInfo.name}</span>
            </div>
            <span className="text-2xl font-bold text-white">{stats.displayRating}</span>
          </div>

          {/* Progress Bar */}
          {nextThreshold && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{currentThreshold.name}</span>
                <span>{nextThreshold.name}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', rankInfo.color.replace('bg-', 'bg-'))}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-center text-xs text-gray-500 mt-1">
                {pointsToNext} points to {nextThreshold.name}
              </div>
            </div>
          )}
        </div>

        {/* Season High */}
        <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
          <span className="text-sm text-gray-400">Season High</span>
          <span className="font-bold text-white">{stats.seasonHighRating}</span>
        </div>

        {/* Placements */}
        <div className="space-y-2">
          <div className="text-sm text-gray-400 mb-2">Placements</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-900/30 rounded p-2 text-center">
              <div className="text-lg font-bold text-yellow-400">{stats.firstPlaces}</div>
              <div className="text-xs text-gray-500">1st</div>
            </div>
            <div className="bg-gray-900/30 rounded p-2 text-center">
              <div className="text-lg font-bold text-gray-300">{stats.secondPlaces}</div>
              <div className="text-xs text-gray-500">2nd</div>
            </div>
            <div className="bg-gray-900/30 rounded p-2 text-center">
              <div className="text-lg font-bold text-orange-400">{stats.thirdPlaces}</div>
              <div className="text-xs text-gray-500">3rd</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { UserSeasonStats } from '@/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsGridProps {
  stats?: UserSeasonStats;
}

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  subValue?: string;
}

function StatCard({ label, value, color = 'text-white', subValue }: StatCardProps) {
  return (
    <Card className="bg-gray-800/50 border-gray-700 p-4">
      <div>
        <div className={cn('text-2xl font-bold', color)}>{value}</div>
        <div className="text-xs text-gray-400 mt-1">{label}</div>
        {subValue && <div className="text-xs text-gray-500 mt-0.5">{subValue}</div>}
      </div>
    </Card>
  );
}

export function StatsGrid({ stats }: StatsGridProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-gray-800/50 border-gray-700 p-4">
            <div className="h-12 bg-gray-700/50 rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  const winRate = stats.totalMatches > 0
    ? ((stats.firstPlaces / stats.totalMatches) * 100).toFixed(1)
    : '0.0';

  const finishRate = stats.totalMatches > 0
    ? Math.round((stats.survivedCount / stats.totalMatches) * 100)
    : 0;

  const podiumRate = stats.totalMatches > 0
    ? (((stats.firstPlaces + stats.secondPlaces + stats.thirdPlaces) / stats.totalMatches) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <StatCard
        label="Rating"
        value={stats.displayRating}
        color="text-blue-400"
        subValue={`Peak: ${stats.seasonHighRating}`}
      />
      <StatCard
        label="Matches"
        value={stats.totalMatches}
      />
      <StatCard
        label="1st Place"
        value={stats.firstPlaces}
        color="text-yellow-400"
        subValue={`${winRate}%`}
      />
      <StatCard
        label="Podiums"
        value={stats.firstPlaces + stats.secondPlaces + stats.thirdPlaces}
        color="text-orange-400"
        subValue={`${podiumRate}%`}
      />
      <StatCard
        label="Finish Rate"
        value={`${finishRate}%`}
        color="text-green-400"
        subValue={`${stats.survivedCount}/${stats.totalMatches}`}
      />
      <StatCard
        label="Assist Used"
        value={stats.assistUsedCount}
        color="text-purple-400"
      />
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MatchResult {
  position: number;
  player: string;
  points: number;
  mmr: number;
  mmrChange: number;
}

interface RecentMatch {
  league: string;
  timeAgo: string;
  playerCount: number;
  avgMmr: number;
  results: MatchResult[];
}

interface RecentMatchesProps {
  matches: RecentMatch[];
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  const getPositionEmoji = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `${position}th`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Matches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.map((match, idx) => (
          <div key={idx}>
            <p className="text-sm mb-2">
              <span className="text-indigo-400 font-semibold">{match.league}</span>
              <span className="text-gray-400 ml-2">
                {match.timeAgo} · {match.playerCount} Players · Avg MMR: {match.avgMmr}
              </span>
            </p>
            <div className="space-y-1">
              {match.results.map((result) => (
                <div key={result.player} className="flex justify-between text-sm">
                  <span>
                    {getPositionEmoji(result.position)} {result.player}
                  </span>
                  <span
                    className={
                      result.mmrChange > 30
                        ? 'text-green-400'
                        : result.mmrChange > 0
                        ? 'text-gray-400'
                        : 'text-red-400'
                    }
                  >
                    {result.points} pts | MMR: {result.mmr} ({result.mmrChange > 0 ? '+' : ''}
                    {result.mmrChange})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

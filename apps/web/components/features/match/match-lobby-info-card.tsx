import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { StatBox, StatBoxValue } from '@/components/ui/stat-box';

interface MatchLobbyInfoCardProps {
  seasonNumber: number | null;
  gameNumber: number | null;
  minPlayers: number;
  maxPlayers: number;
  currentPlayers: number;
}

export function MatchLobbyInfoCard({
  seasonNumber,
  gameNumber,
  minPlayers,
  maxPlayers,
  currentPlayers,
}: MatchLobbyInfoCardProps) {
  return (
    <Card showGradient>
      <CardHeader>
        <CardTitle>Lobby Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Season */}
        {seasonNumber !== null && (
          <StatBox label="Season">
            <StatBoxValue>Season {seasonNumber}</StatBoxValue>
          </StatBox>
        )}

        {/* Game Number */}
        {gameNumber !== null && (
          <StatBox label="Game">
            <StatBoxValue>#{gameNumber}</StatBoxValue>
          </StatBox>
        )}

        {/* Player Count */}
        <StatBox label="Players" colSpan={2} className="[&>p:first-child]:mb-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Current: {currentPlayers}</span>
                <span>Max: {maxPlayers}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((currentPlayers / maxPlayers) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Min: {minPlayers} players
              </p>
            </div>
          </div>
        </StatBox>
        </div>
      </CardContent>
    </Card>
  );
}

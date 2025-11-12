import {
  MatchCard,
  MatchCardHeader,
  MatchCardTitle,
  MatchCardContent,
} from '@/components/ui/match-card';

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
    <MatchCard>
      <MatchCardHeader>
        <MatchCardTitle>Lobby Information</MatchCardTitle>
      </MatchCardHeader>
      <MatchCardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Season */}
        {seasonNumber !== null && (
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <p className="text-sm text-gray-400 mb-1">Season</p>
            <p className="text-xl font-bold text-white">Season {seasonNumber}</p>
          </div>
        )}

        {/* Game Number */}
        {gameNumber !== null && (
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <p className="text-sm text-gray-400 mb-1">Game</p>
            <p className="text-xl font-bold text-white">#{gameNumber}</p>
          </div>
        )}

        {/* Player Count */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30 md:col-span-2">
          <p className="text-sm text-gray-400 mb-3">Players</p>
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
        </div>
        </div>
      </MatchCardContent>
    </MatchCard>
  );
}

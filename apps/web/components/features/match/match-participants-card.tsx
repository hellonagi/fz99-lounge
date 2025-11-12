import { MatchCard, MatchCardContent } from '@/components/ui/match-card';

interface Participant {
  user: {
    id: string;
    profileId: number;
    displayName: string | null;
    avatarHash: string | null;
  };
}

interface MatchParticipantsCardProps {
  participants: Participant[];
}

export function MatchParticipantsCard({ participants }: MatchParticipantsCardProps) {
  const getAvatarUrl = (userId: string, avatarHash: string | null) => {
    if (avatarHash) {
      return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
  };

  return (
    <MatchCard>
      <MatchCardContent>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Participants</h2>
          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-semibold border border-blue-500/50">
            {participants.length} players
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No participants data available</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {participants.map((participant, index) => (
            <div
              key={participant.user.id}
              className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all duration-200 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={getAvatarUrl(participant.user.id, participant.user.avatarHash)}
                    alt={participant.user.displayName || `Player ${index + 1}`}
                    className="w-12 h-12 rounded-full border-2 border-gray-700"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-gray-900 rounded-full px-1.5 py-0.5 border border-gray-700">
                    <span className="text-xs font-bold text-gray-300">
                      #{index + 1}
                    </span>
                  </div>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {participant.user.displayName || `Player ${participant.user.profileId}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    ID: {participant.user.profileId}
                  </p>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </MatchCardContent>
    </MatchCard>
  );
}

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import type { User, UserSeasonStats } from '@/types';

interface ProfileHeaderProps {
  user: User;
  seasonStats?: UserSeasonStats;
}

export function ProfileHeader({ user, seasonStats }: ProfileHeaderProps) {
  const avatarUrl = useAvatarUrl(user.discordId, user.avatarHash, 96);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-gray-800 shadow-lg overflow-hidden sm:rounded-md mb-6">
      <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 px-4 py-6 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-gray-700">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={user.displayName || 'User'} priority />}
              <AvatarFallback className="text-2xl">
                {user.displayName?.slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* User Info */}
          <div className="flex-1 text-center sm:text-left">
            {/* Name & Country */}
            <div className="flex items-center justify-center sm:justify-start gap-2">
              {user.country && (
                <span
                  className={`fi fi-${user.country.toLowerCase()}`}
                  title={user.country}
                />
              )}
              <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
            </div>

            {/* Stats Row */}
            {seasonStats && (
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2 text-sm">
                {/* Leaderboard Rank */}
                {seasonStats.leaderboardRank && (
                  <div>
                    <span className="text-gray-400">CLASSIC </span>
                    <span className="font-bold text-yellow-400">#{seasonStats.leaderboardRank}</span>
                  </div>
                )}

                {/* Total Matches */}
                <div>
                  <span className="text-gray-400">Matches </span>
                  <span className="font-bold text-white">{seasonStats.totalMatches}</span>
                </div>

                {/* Wins */}
                <div>
                  <span className="text-gray-400">Wins </span>
                  <span className="font-bold text-yellow-400">{seasonStats.firstPlaces}</span>
                </div>
              </div>
            )}

            {/* Join Date */}
            {user.createdAt && (
              <div className="mt-2 text-xs text-gray-500">
                Joined {formatDate(user.createdAt)}
              </div>
            )}

            {/* Stream Links */}
            {(user.youtubeUrl || user.twitchUrl) && (
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-3">
                {user.youtubeUrl && (
                  <a
                    href={user.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors text-sm"
                  >
                    YouTube
                  </a>
                )}
                {user.twitchUrl && (
                  <a
                    href={user.twitchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-md transition-colors text-sm"
                  >
                    Twitch
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

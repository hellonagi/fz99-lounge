import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import type { User } from '@/types';

interface ProfileHeaderProps {
  user: User;
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const avatarUrl = useAvatarUrl(user.discordId, user.avatarHash, 96);

  return (
    <div className="bg-gray-800 shadow-lg overflow-hidden sm:rounded-md mb-6">
      <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 px-4 py-6 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-gray-700">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={user.displayName || 'User'} />}
              <AvatarFallback className="text-2xl">
                {user.displayName?.slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start space-x-3">
              <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Discord:</span>
                <span className="font-medium text-gray-300">{user.username}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

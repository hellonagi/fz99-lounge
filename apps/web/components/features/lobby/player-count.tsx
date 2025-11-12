import { Button } from '@/components/ui/button';

interface PlayerCountProps {
  current: number;
  min?: number;
  max: number;
  onJoin?: () => void;
  isJoined?: boolean;
  isJoining?: boolean;
}

export function PlayerCount({ current, min, max, onJoin, isJoined = false, isJoining = false }: PlayerCountProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
      <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-5 py-3 border border-white/20">
        <div className="relative">
          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-white">
            {current}/{max}
          </span>
        </div>
        <span className="text-sm text-gray-300">Players</span>
      </div>
      {onJoin && (
        <Button
          onClick={onJoin}
          size="lg"
          className="rounded-full"
          disabled={isJoining}
          variant={isJoined ? "outline" : "default"}
        >
          {isJoining ? 'Loading...' : isJoined ? 'LEAVE' : 'JOIN NOW'}
        </Button>
      )}
    </div>
  );
}

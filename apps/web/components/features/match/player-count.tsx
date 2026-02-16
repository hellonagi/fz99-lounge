import { Button, buttonVariants } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SiDiscord } from 'react-icons/si';

interface PlayerCountProps {
  current: number;
  min?: number;
  max: number;
  onJoin?: () => void;
  isJoined?: boolean;
  isJoining?: boolean;
  isAuthenticated?: boolean;
}

export function PlayerCount(props: PlayerCountProps) {
  const { current, max, onJoin, isJoined = false, isJoining = false, isAuthenticated = true } = props;
  const t = useTranslations('matchHero');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  return (
    <div className="flex flex-col items-center justify-center gap-4 mb-8">
      <div className="flex flex-col sm:flex-row items-center gap-4">
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
        {!isAuthenticated ? (
          <a
            href={`${baseUrl}/api/auth/discord`}
            className={cn(buttonVariants({ size: 'lg', variant: 'discord' }), 'rounded-full')}
          >
            <SiDiscord className="w-5 h-5 mr-2" />
            {t('loginToJoin')}
          </a>
        ) : onJoin && (
          <Button
            onClick={onJoin}
            size="lg"
            className="rounded-full"
            disabled={isJoining}
            variant={isJoined ? "outline" : "default"}
          >
            {isJoining ? t('joining') : isJoined ? t('leave') : t('join')}
          </Button>
        )}
      </div>
      {isJoined && (
        <p className="text-sm text-gray-300">{t('passcodeNotice')}</p>
      )}
    </div>
  );
}

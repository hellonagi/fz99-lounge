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
      <div className="flex flex-row items-center gap-4">
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
            className={cn(buttonVariants({ size: 'default', variant: 'discord' }), 'rounded-full md:px-6 md:py-3 md:text-base')}
          >
            <SiDiscord className="w-4 h-4 mr-1.5 md:w-5 md:h-5 md:mr-2" />
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
      <p className={cn('text-sm', isJoined ? 'text-gray-300' : 'text-transparent select-none')}>{t('passcodeNotice')}</p>
    </div>
  );
}

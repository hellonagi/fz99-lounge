'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { SiDiscord } from 'react-icons/si';
import { User, LogOut, Shield } from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface HeaderProps {
  mounted: boolean;
  locale: string;
}

export default function Header({ mounted, locale }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuthStore();
  const avatarUrl = useAvatarUrl(user?.discordId, user?.avatarHash, 32);
  const router = useRouter();
  const t = useTranslations('nav');
  usePushNotifications();

  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/discord`;
  };

  const handleLogout = () => {
    logout();
    router.push(`/${locale}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-gray-900/70 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href={`/${locale}`}>
                <h1 className="text-xl font-bold text-gray-100">FZ99 Lounge</h1>
              </Link>
            </div>
            <nav className="hidden md:flex space-x-6">
              <Link
                href={`/${locale}/rules`}
                className="text-gray-300 hover:text-white text-sm font-medium"
              >
                {t('rules')}
              </Link>
              <Link
                href={`/${locale}/leaderboard`}
                className="text-gray-300 hover:text-white text-sm font-medium"
              >
                {t('leaderboard')}
              </Link>
              <Link
                href={`/${locale}/results`}
                className="text-gray-300 hover:text-white text-sm font-medium"
              >
                {t('results')}
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-3">
            <LanguageSwitcher currentLocale={locale} />
            {!mounted ? (
              <div className="w-32 h-10" />
            ) : isAuthenticated && user && user.displayName ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium text-white hover:bg-gray-700">
                    <Avatar className="h-6 w-6">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={user.displayName} />}
                      <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{user.displayName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push(`/${locale}/profile/${user.id}`)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>{t('profile')}</span>
                  </DropdownMenuItem>
                  {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push(`/${locale}/admin`)}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>{t('admin')}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isAuthenticated && user ? (
              <div className="text-gray-400 text-sm">{t('login')}...</div>
            ) : (
              <Button onClick={handleLogin} variant="discord" size="sm">
                <SiDiscord className="w-4 h-4 mr-1.5" />
                <span>{t('login')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* モバイル用ナビ */}
      <nav className="md:hidden border-t border-white/10">
        <div className="flex justify-around py-2 px-4">
          <Link
            href={`/${locale}/rules`}
            className="text-gray-300 hover:text-white text-xs font-medium"
          >
            {t('rules')}
          </Link>
          <Link
            href={`/${locale}/leaderboard`}
            className="text-gray-300 hover:text-white text-xs font-medium"
          >
            {t('leaderboard')}
          </Link>
          <Link
            href={`/${locale}/results`}
            className="text-gray-300 hover:text-white text-xs font-medium"
          >
            {t('results')}
          </Link>
        </div>
      </nav>
    </header>
  );
}

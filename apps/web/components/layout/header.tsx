'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface HeaderProps {
  mounted: boolean;
}

export default function Header({ mounted }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuthStore();
  const avatarUrl = useAvatarUrl(user?.discordId, user?.avatarHash, 32);
  const router = useRouter();

  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/discord`;
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href="/">
                <h1 className="text-xl font-bold text-gray-100">FZ99 Lounge</h1>
              </Link>
            </div>
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/rules"
                className="text-gray-300 hover:text-white text-sm font-medium"
              >
                Rules
              </Link>
              <Link
                href="/leaderboard"
                className="text-gray-300 hover:text-white text-sm font-medium"
              >
                Leaderboard
              </Link>
              <Link
                href="/results"
                className="text-gray-300 hover:text-white text-sm font-medium"
              >
                Results
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-3 py-1 text-sm text-gray-300 hover:text-white">
              <span className="hidden sm:inline">EN</span>
              <span className="sm:hidden">🌐</span>
            </button>
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
                  <DropdownMenuItem onClick={() => router.push(`/profile/${user.id}`)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isAuthenticated && user ? (
              <div className="text-gray-400 text-sm">Setting up...</div>
            ) : (
              <Button onClick={handleLogin} variant="discord">
                <SiDiscord className="w-5 h-5 mr-2" />
                <span>Discord Login</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

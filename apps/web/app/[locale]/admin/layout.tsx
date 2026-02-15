'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('adminTabs');

  // Extract locale from pathname
  const locale = pathname.split('/')[1];
  // Get the current tab from pathname
  const pathParts = pathname.split('/');
  const currentTab = pathParts[pathParts.length - 1] || 'matches';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (!isAuthenticated || !user) {
        router.push('/');
        return;
      }

      if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
        router.push('/');
        return;
      }
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Access Denied</div>
      </div>
    );
  }

  const tabs = [
    { id: 'matches', label: t('matches'), href: `/${locale}/admin/matches` },
    ...(user.role === 'ADMIN'
      ? [
          { id: 'moderators', label: t('moderators'), href: `/${locale}/admin/moderators` },
          { id: 'users', label: t('users'), href: `/${locale}/admin/users` },
          { id: 'seasons', label: t('seasons'), href: `/${locale}/admin/seasons` },
          { id: 'settings', label: t('settings'), href: `/${locale}/admin/settings` },
        ]
      : []),
  ];

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">
            Manage matches, seasons, and settings
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-700 mb-6">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap px-4 sm:px-6 py-3 text-sm font-medium transition-colors',
                  'hover:text-white hover:bg-gray-700/50',
                  currentTab === tab.id
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

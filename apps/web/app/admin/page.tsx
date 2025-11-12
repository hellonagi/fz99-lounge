'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { CreateLobbyCard } from '@/components/features/admin/create-lobby-card';
import { LobbiesListCard } from '@/components/features/admin/lobbies-list-card';

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // Check authentication and role
      if (!isAuthenticated || !user) {
        router.push('/');
        return;
      }

      // Check if user is Admin or Moderator
      if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
        router.push('/');
        return;
      }
    }
  }, [mounted, isAuthenticated, user, router]);

  // Show loading while checking auth
  if (!mounted || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Check role
  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Access Denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">
            Manage lobbies, seasons, users, and match results
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create Lobby Card */}
            <div className="lg:col-span-2">
              <CreateLobbyCard />
            </div>

            {/* Placeholder for future features */}
            <div className="space-y-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Season Management</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Create and manage seasons
                </p>
                <button
                  onClick={() => router.push('/admin/seasons')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Manage Seasons
                </button>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">User Management</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Manage users and permissions
                </p>
                <button
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 text-gray-500 rounded-md cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Score Approval</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Review and approve match results
                </p>
                <button
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 text-gray-500 rounded-md cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>

          {/* Lobbies List */}
          <LobbiesListCard />
        </div>
      </div>
    </div>
  );
}

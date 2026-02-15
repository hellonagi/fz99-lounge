'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { UserManagementCard } from '@/components/features/admin/user-management-card';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/admin/matches');
    }
  }, [user, router]);

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="space-y-6">
      <UserManagementCard />
    </div>
  );
}

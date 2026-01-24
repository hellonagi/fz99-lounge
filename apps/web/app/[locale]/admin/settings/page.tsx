'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { RatingRecalculationCard } from '@/components/features/admin/rating-recalculation-card';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Settings page is ADMIN only
    if (user && user.role !== 'ADMIN') {
      router.push('/admin/matches');
    }
  }, [user, router]);

  // Only ADMIN can access settings
  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <RatingRecalculationCard />
      </div>
    </div>
  );
}

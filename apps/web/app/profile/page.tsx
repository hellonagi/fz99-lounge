'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function ProfileRedirectPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (isAuthenticated && user && user.id) {
        // ログイン済み: 自分のユーザーIDにリダイレクト
        router.push(`/profile/${user.id}`);
      } else {
        // 未ログイン: トップページにリダイレクト
        router.push('/');
      }
    }
  }, [mounted, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
    </div>
  );
}

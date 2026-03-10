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
    if (!mounted) return;

    if (isAuthenticated && user?.profileNumber) {
      router.push(`/profile/${user.profileNumber}`);
    } else if (!isAuthenticated && user === null) {
      // 未ログイン確定: トップページにリダイレクト
      router.push('/');
    }
    // profileNumberがまだない場合はAPI更新を待つ（client-layout.tsxがsetUserする）
  }, [mounted, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
    </div>
  );
}

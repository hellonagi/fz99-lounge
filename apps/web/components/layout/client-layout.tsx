'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { DisplayNameSetupModal } from '@/components/features/auth/display-name-setup-modal';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // クライアント側でマウント後にハイドレーションを実行
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setMounted(true);
  }, []);

  // ログイン済みでdisplayName未設定の場合、モーダルを表示
  const showSetupModal = mounted && isAuthenticated && user && !user.displayName;

  return (
    <>
      {children}
      {showSetupModal && <DisplayNameSetupModal open={true} />}
    </>
  );
}

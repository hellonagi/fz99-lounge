'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { DisplayNameSetupModal } from '@/components/features/auth/display-name-setup-modal';
import Header from '@/components/layout/header';

interface ClientLayoutProps {
  children: React.ReactNode;
  locale: string;
}

export function ClientLayout({ children, locale }: ClientLayoutProps) {
  const { isAuthenticated, user, setUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  // クライアント側でマウント後にハイドレーションを実行
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setMounted(true);
  }, []);

  // ハイドレーション後、必要に応じてAPIからユーザー情報を取得
  useEffect(() => {
    if (!mounted) return;

    const { isAuthenticated: isAuth, user: currentUser } = useAuthStore.getState();

    // localStorageにユーザー情報がない場合のみAPIから取得
    // （ブラウザ変更時やlocalStorage削除時に対応）
    if (!isAuth || !currentUser) {
      authApi
        .getProfile()
        .then((response) => {
          // 未認証の場合はnullが返るため、nullでない場合のみsetUser
          if (response.data) {
            setUser(response.data);
          }
        })
        .catch(() => {
          // ネットワークエラー等 → 何もしない
        })
        .finally(() => {
          setReady(true);
        });
    } else {
      setReady(true);
    }
  }, [mounted, setUser]);

  // ログイン済みでdisplayName未設定の場合、モーダルを表示
  const showSetupModal = mounted && ready && isAuthenticated && user && !user.displayName;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <Header mounted={mounted} locale={locale} />
      {children}
      {showSetupModal && <DisplayNameSetupModal open={true} />}
    </div>
  );
}

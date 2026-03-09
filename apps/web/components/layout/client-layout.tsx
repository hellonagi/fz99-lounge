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

  // ハイドレーション後、APIからユーザー情報を取得
  // キャッシュがある場合は即座にreadyにし、バックグラウンドで最新情報を取得
  useEffect(() => {
    if (!mounted) return;

    const { isAuthenticated: isAuth, user: currentUser } = useAuthStore.getState();

    // キャッシュがある場合は即座にreadyにする
    if (isAuth && currentUser) {
      setReady(true);
    }

    // 常にAPIから最新のプロフィールを取得（role変更等を反映）
    authApi
      .getProfile()
      .then((response) => {
        // OptionalJwtAuthGuardはJWT無効時にnullを返す
        if (response.data) {
          setUser(response.data);
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        // JWT期限切れ等(401) → ログアウト状態にする
        if (err.response?.status === 401) {
          setUser(null);
        }
        // ネットワークエラー等 → キャッシュで表示を維持
      })
      .finally(() => {
        setReady(true);
      });
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

// このスクリプトをブラウザのコンソールで実行してください
// ユーザー情報を最新の状態に更新します

async function refreshUserProfile() {
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('❌ トークンが見つかりません。ログインしてください。');
    return;
  }

  try {
    console.log('🔄 ユーザー情報を取得中...');

    const apiUrl = window.location.origin;
    const response = await fetch(`${apiUrl}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const user = await response.json();
    console.log('✅ ユーザー情報を取得しました:', user);

    // Zustand storeの状態を更新
    const authStorage = JSON.parse(localStorage.getItem('auth-storage') || '{}');

    if (authStorage.state) {
      authStorage.state.user = user;
      localStorage.setItem('auth-storage', JSON.stringify(authStorage));
      console.log('✅ ローカルストレージを更新しました');
      console.log('Role:', user.role);

      if (user.role === 'ADMIN') {
        console.log('🎉 ADMIN権限が確認されました！');
      }

      console.log('🔄 ページをリロードして変更を反映します...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      console.error('❌ auth-storageが見つかりません');
    }
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行
refreshUserProfile();
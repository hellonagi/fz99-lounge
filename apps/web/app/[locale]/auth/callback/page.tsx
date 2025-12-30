'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';

export default function AuthCallback() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clean up legacy localStorage data
    localStorage.removeItem('token');

    // Remove token from URL if present (for security)
    const url = new URL(window.location.href);
    if (url.searchParams.has('token')) {
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname);
    }

    // Cookie is already set by the API, just fetch profile
    authApi
      .getProfile()
      .then((response) => {
        const user = response.data;
        setUser(user);
        router.push('/');
      })
      .catch((err) => {
        console.error('Failed to fetch user profile:', err);
        setError('Failed to authenticate. Please try again.');
        setTimeout(() => router.push('/'), 3000);
      });
  }, [setUser, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-400 mb-4 text-xl">Warning</div>
            <p className="text-red-400">{error}</p>
            <p className="text-gray-400 text-sm mt-2">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Logging in...</p>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // Save token first
      localStorage.setItem('token', token);

      // Fetch user profile with token
      authApi
        .getProfile()
        .then((response) => {
          const user = response.data;
          login(token, user);
          router.push('/');
        })
        .catch((err) => {
          console.error('Failed to fetch user profile:', err);
          setError('Failed to authenticate. Please try again.');
          localStorage.removeItem('token');
          setTimeout(() => router.push('/'), 3000);
        });
    } else {
      setError('No authentication token found.');
      setTimeout(() => router.push('/'), 2000);
    }
  }, [searchParams, login, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-400 mb-4 text-xl">⚠️</div>
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

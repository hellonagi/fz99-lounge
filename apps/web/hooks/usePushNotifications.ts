import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

type PushStatus = 'loading' | 'granted' | 'denied' | 'prompt' | 'unsupported';

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuthStore();
  const [status, setStatus] = useState<PushStatus>('loading');

  const registerSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      const vapidResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/push-notifications/vapid-public-key`
      );
      if (!vapidResponse.ok) return;
      const { publicKey } = await vapidResponse.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/push-notifications/subscribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(subscription),
        }
      );

      setStatus('granted');
    } catch (error) {
      console.error('Failed to register push notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'granted') {
      registerSubscription();
    } else if (permission === 'denied') {
      setStatus('denied');
    } else {
      Notification.requestPermission().then((result) => {
        if (result === 'granted') {
          registerSubscription();
        } else {
          setStatus(result as PushStatus);
        }
      });
    }
  }, [isAuthenticated, user, registerSubscription]);

  return { status };
}

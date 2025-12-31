import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const registerPushNotifications = async () => {
      try {
        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          console.log('Service Workers not supported');
          return;
        }

        // Check if Push API is supported
        if (!('PushManager' in window)) {
          console.log('Push API not supported');
          return;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }

        // Get VAPID public key from API
        const vapidResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/push-notifications/vapid-public-key`
        );
        const { publicKey } = await vapidResponse.json();

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });

        // Send subscription to backend
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/push-notifications/subscribe`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(subscription),
          }
        );

        console.log('Push notification subscription successful');
      } catch (error) {
        console.error('Failed to register push notifications:', error);
      }
    };

    registerPushNotifications();
  }, [isAuthenticated, user]);
}

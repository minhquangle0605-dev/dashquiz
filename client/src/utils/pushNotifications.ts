import { subscribePush, unsubscribePush } from '@/services/notification.api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch {
    return null;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    const permission = await requestPushPermission();
    if (!permission) return false;

    const registration = await registerServiceWorker();
    if (!registration) return false;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('VITE_VAPID_PUBLIC_KEY not set, skipping push subscription');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys) return false;

    await subscribePush({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh!,
        auth: json.keys.auth!,
      },
    });

    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    await unsubscribePush(subscription.endpoint);
    await subscription.unsubscribe();

    return true;
  } catch {
    return false;
  }
}

export async function initPushOnFirstLogin(): Promise<void> {
  const key = 'webquiz-push-asked';
  if (localStorage.getItem(key)) return;

  localStorage.setItem(key, '1');
  await subscribeToPush();
}

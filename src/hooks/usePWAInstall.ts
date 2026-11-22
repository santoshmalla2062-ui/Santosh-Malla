import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let cachedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let cachedIsInstalled = false;
let initializedGlobalPwaListeners = false;
const pwaListeners = new Set<() => void>();

function notifyPwaListeners() {
  pwaListeners.forEach((cb) => cb());
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function ensureGlobalPwaListeners() {
  if (typeof window === 'undefined' || initializedGlobalPwaListeners) return;
  initializedGlobalPwaListeners = true;
  cachedIsInstalled = detectStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyPwaListeners();
  });

  window.addEventListener('appinstalled', () => {
    cachedIsInstalled = true;
    cachedDeferredPrompt = null;
    notifyPwaListeners();
  });
}

if (typeof window !== 'undefined') {
  ensureGlobalPwaListeners();
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => cachedDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => cachedIsInstalled || detectStandalone());
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isEmbeddedWebView, setIsEmbeddedWebView] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    ensureGlobalPwaListeners();

    const syncState = () => {
      setDeferredPrompt(cachedDeferredPrompt);
      setIsInstalled(cachedIsInstalled || detectStandalone());
    };
    syncState();

    const userAgent = window.navigator.userAgent || '';
    const lowerUa = userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(lowerUa));
    setIsAndroid(/android/.test(lowerUa));
    setIsEmbeddedWebView(/FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger|wv\)/i.test(userAgent));

    pwaListeners.add(syncState);
    return () => {
      pwaListeners.delete(syncState);
    };
  }, []);

  const install = async () => {
    const promptToUse = deferredPrompt || cachedDeferredPrompt;
    if (!promptToUse) return false;
    await promptToUse.prompt();
    const { outcome } = await promptToUse.userChoice;
    if (outcome === 'accepted') {
      cachedIsInstalled = true;
      cachedDeferredPrompt = null;
      notifyPwaListeners();
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!(deferredPrompt || cachedDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isEmbeddedWebView,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

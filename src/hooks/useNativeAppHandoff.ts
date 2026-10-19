import { useEffect } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { protectionBridge } from '../services/protection/nativeBridge';
import { useAppStore } from '../store/appStore';
import { useWellbeingStore } from '../store/wellbeingStore';

// Retain a consumed native request if an effect is replaced while the native call is in flight.
let pendingRequest: ReturnType<typeof protectionBridge.consumePendingLaunch> | null = null;

/** Consume an iOS shield button request only once the navigation tree and saved preferences are ready. */
export function useNativeAppHandoff(navigationReady: boolean) {
  useEffect(() => {
    if (!navigationReady) return;
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking || cancelled || AppState.currentState !== 'active' || !useAppStore.persist.hasHydrated() || !useWellbeingStore.persist.hasHydrated()) return;
      checking = true;
      try {
        const request = pendingRequest ??= protectionBridge.consumePendingLaunch();
        const target = await request;
        if (!target) { if (pendingRequest === request) pendingRequest = null; return; }
        if (cancelled) return;
        pendingRequest = null;
        if (target === 'protection') router.replace('/protection');
        else router.replace({ pathname: '/native-app/[appId]', params: { appId: target } });
      } finally { checking = false; }
    };
    const appHydrated = useAppStore.persist.onFinishHydration(() => { void check(); });
    const wellbeingHydrated = useWellbeingStore.persist.onFinishHydration(() => { void check(); });
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
    void check();
    return () => { cancelled = true; appHydrated(); wellbeingHydrated(); subscription.remove(); };
  }, [navigationReady]);
}

import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useWellbeingStore } from '../store/wellbeingStore';

export function useLaunchReadiness() {
  const [ready, setReady] = useState(useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated());
  useEffect(() => {
    const update = () => setReady(useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated());
    const app = useAppStore.persist.onFinishHydration(update);
    const wellbeing = useWellbeingStore.persist.onFinishHydration(update);
    update();
    return () => { app(); wellbeing(); };
  }, []);
  return ready;
}

import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useFamilyStore } from '../store/familyStore';
import { useWellbeingStore } from '../store/wellbeingStore';

/** Waits for saved settings and the phone's family role, so a supervised phone never starts as a personal one. */
export function useLaunchReadiness() {
  const hydrated = () => useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated() && useFamilyStore.persist.hasHydrated();
  const [ready, setReady] = useState(hydrated);
  useEffect(() => {
    const update = () => setReady(hydrated());
    const app = useAppStore.persist.onFinishHydration(update);
    const wellbeing = useWellbeingStore.persist.onFinishHydration(update);
    const family = useFamilyStore.persist.onFinishHydration(update);
    update();
    return () => { app(); wellbeing(); family(); };
  }, []);
  return ready;
}

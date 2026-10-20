import { useEffect } from 'react';
import { useSegments } from 'expo-router';
import { captureProductEvent, initializeProductAnalytics, screenNameForSegments, trackProductScreen } from '../services/analytics/productAnalytics';

/** Keep navigation observation outside the layout that creates Protected groups. */
export function AnalyticsObserver() {
  const segments = useSegments();
  const screen = screenNameForSegments(segments);
  useEffect(() => {
    let active = true;
    void initializeProductAnalytics().then(() => {
      if (!active) return;
      trackProductScreen(screen);
      if (screen === 'Welcome') captureProductEvent('onboarding_started', { source: 'welcome' });
    });
    return () => { active = false; };
  }, [screen]);
  return null;
}

import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import type { CloudSettings } from './types';

/** Call after the user chooses to back up settings. No network request is made here. */
export function captureSettingsBackup(): CloudSettings {
  const { selectedLanguage, themeMode, apps, schedules, dailyGoalMinutes, goalNotifications, completionNotifications, onboardingCompleted } = useAppStore.getState();
  const { launchDestination, sleep } = useWellbeingStore.getState();
  const onboarding = useOnboardingStore.getState();
  // Clone so later store mutations cannot alter a pending backup.
  return JSON.parse(JSON.stringify({
    schemaVersion: 1,
    preferences: { selectedLanguage, themeMode, apps, schedules, dailyGoalMinutes, goalNotifications, completionNotifications },
    wellbeing: { launchDestination, sleep },
    onboarding: { completed: onboardingCompleted, usualMinutes: Math.min(1440, Math.max(0, Math.round(totalMinutes(onboarding)))), cut: onboarding.cut },
  })) as CloudSettings;
}

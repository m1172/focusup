import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import type { CloudSettings } from './types';

/** Call after the user chooses to back up settings. No network request is made here. */
export function captureSettingsBackup(): CloudSettings {
  const { selectedLanguage, themeMode, apps, schedules, dailyGoalMinutes, goalNotifications, completionNotifications } = useAppStore.getState();
  const { launchDestination, sleep } = useWellbeingStore.getState();
  // Clone so later store mutations cannot alter a pending backup.
  return JSON.parse(JSON.stringify({
    schemaVersion: 1,
    preferences: { selectedLanguage, themeMode, apps, schedules, dailyGoalMinutes, goalNotifications, completionNotifications },
    wellbeing: { launchDestination, sleep },
  })) as CloudSettings;
}

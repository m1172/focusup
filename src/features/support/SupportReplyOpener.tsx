import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { isSupportReply } from '../../services/notifications/supportPush';

/**
 * Opens the support chat when the user taps a reply notification, including the tap
 * that cold-started the app. Waits for navigation and a signed-in account first.
 */
export function SupportReplyOpener({ enabled }: { enabled: boolean }) {
  const navigation = useRootNavigationState();
  const pathname = usePathname();
  const response = Notifications.useLastNotificationResponse();
  const ready = enabled && Boolean(navigation?.key);
  useEffect(() => {
    if (!ready || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER || !isSupportReply(response.notification)) return;
    // Clearing first keeps the same tap from opening the chat again after a remount.
    Notifications.clearLastNotificationResponse();
    if (pathname !== '/support') router.push('/support');
  }, [ready, response, pathname]);
  return null;
}

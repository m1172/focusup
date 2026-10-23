import { accountApi, isBackendConfigured } from '../../services/backend/accountSession';
import { registerSupportPush } from '../../services/notifications/supportPush';
import { useAccountStore } from '../../store/accountStore';

/** Registers the signed-in user's device for reply notifications; `ask` may show the permission prompt once. */
export function syncSupportPush(ask = false): Promise<boolean> {
  const { user, recoveryRequired } = useAccountStore.getState();
  if (!user || recoveryRequired || !isBackendConfigured()) return Promise.resolve(false);
  return registerSupportPush(accountApi(), user.id, ask);
}

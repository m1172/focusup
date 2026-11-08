import { childProtectionState, type ChildProtectionState } from '../../services/family/resolver';
import type { FamilyChild } from '../../services/family/types';

export const statusVariant: Record<ChildProtectionState, 'success' | 'danger' | 'muted' | 'primary'> = { applied: 'success', waiting: 'muted', setupNeeded: 'primary', unavailable: 'danger', removing: 'muted' };

/** "Setup needed", "Waiting for device", "Applied" or "Protection unavailable", from the phone's last report. */
export const childState = (child: FamilyChild) => childProtectionState({ removalPending: child.removalPending, policyRevision: child.policy.revision, device: child.device ? { appliedRevision: child.device.appliedRevision, report: child.device.report } : null });

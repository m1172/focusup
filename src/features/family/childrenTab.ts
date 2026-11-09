import { FAMILY_ENABLED } from '../../config/release';
import { useAccountStore } from '../../store/accountStore';
import { useFamilyStore } from '../../store/familyStore';

/** Whether this phone belongs to a parent who can manage children: Family is on, signed in, not a supervised phone. */
export function useShowsChildrenTab() {
  const signedIn = useAccountStore((state) => Boolean(state.user));
  const role = useFamilyStore((state) => state.role);
  return FAMILY_ENABLED && signedIn && role === 'none';
}

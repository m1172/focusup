import type { CustomerInfo } from 'react-native-purchases';
import { PRO_ENTITLEMENT_ID } from './subscriptionConfig';

export function hasProEntitlement(customerInfo: Pick<CustomerInfo, 'entitlements'> | null | undefined): boolean {
  return Boolean(customerInfo?.entitlements.active[PRO_ENTITLEMENT_ID]);
}

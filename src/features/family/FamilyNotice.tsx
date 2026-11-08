import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../store/familyStore';

/** Tells the person once that family rules were lifted from this phone (removed, replaced, or ended at 18). */
export function FamilyNotice() {
  const { t } = useTranslation();
  const notice = useFamilyStore((state) => state.notice);
  useEffect(() => {
    if (!notice) return;
    Alert.alert(t(`family.child.notice.${notice}Title`), t(`family.child.notice.${notice}Body`), [{ text: t('family.child.notice.ok'), onPress: () => useFamilyStore.getState().dismissNotice() }], { cancelable: true, onDismiss: () => useFamilyStore.getState().dismissNotice() });
  }, [notice, t]);
  return null;
}

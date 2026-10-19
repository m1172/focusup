import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Text } from '../../components/Typography';
import { useAppTheme } from '../../theme';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { protectionBridge } from '../../services/protection/nativeBridge';

export function NativeAppProtectionCard({ appId, name }: { appId: string; name: string }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const status = useProtectionStatusStore((state) => state.status);
  useFocusEffect(useCallback(() => {
    let active = true;
    void protectionBridge.getStatus().then((next) => { if (active) useProtectionStatusStore.getState().setStatus(next); });
    return () => { active = false; };
  }, []));
  const blocked = status.supported && status.authorized && status.active && status.protectedPlatforms?.some((platform) => platform === appId);
  return <Pressable accessibilityRole="button" accessibilityLabel={t('browser.blockOriginal', { name })}
    onPress={() => router.push({ pathname: '/protection', params: { appId } })}
    style={({ pressed }) => ({ padding: 16, borderRadius: 22, backgroundColor: c.soft, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
    <Icon name="shieldCheck" size={26} color={c.ink} />
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{t(blocked ? 'browser.originalBlocked' : 'browser.blockOriginal', { name })}</Text>
      <Text style={{ color: c.text2, fontSize: 12, lineHeight: 18 }}>{t('browser.blockOriginalDetail')}</Text>
    </View>
    <Icon name="chevron" size={18} color={c.text2} />
  </Pressable>;
}

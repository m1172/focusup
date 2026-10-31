import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { AppIcon } from '../components/AppIcon';
import { BackButton, Card, Heading, Note, Screen } from '../components/ui';
import { useAppTheme } from '../theme';
import { useWellbeingStore } from '../store/wellbeingStore';
import { useAppStore } from '../store/appStore';
import { AVAILABLE_APPS, appCatalog } from '../features/apps/catalog';
import { DAILY_LIMIT_OPTIONS, minutesUsedToday } from '../features/protection/dailyLimit';
import { formatDuration } from '../utils/formatDuration';
import type { SocialAppId } from '../types/app';

/** Minutes a day per app. Reaching a limit blocks the app (and its clean browser) until midnight. */
export default function DailyLimitsScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((state) => state.selectedLanguage);
  const limits = useWellbeingStore((state) => state.dailyLimits);
  const setDailyLimit = useWellbeingStore((state) => state.setDailyLimit);
  const [used, setUsed] = useState<Partial<Record<SocialAppId, number>>>({});
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all(AVAILABLE_APPS.map(async (id) => [id, await minutesUsedToday(id)] as const))
      .then((entries) => { if (active) setUsed(Object.fromEntries(entries)); }).catch(() => undefined);
    return () => { active = false; };
  }, []));

  return <Screen contentStyle={{ gap: 14 }}>
    <BackButton label={t('back')} />
    <Heading title={t('ui.dailyLimits')} subtitle={t('ui.dailyLimitsBody')} />
    {AVAILABLE_APPS.map((appId) => {
      const limit = limits[appId] ?? null;
      const minutes = used[appId] ?? 0;
      const options: (number | null)[] = [null, ...DAILY_LIMIT_OPTIONS];
      return <Card key={appId} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIcon appId={appId} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{appCatalog[appId].name}</Text>
            <Text style={{ color: limit !== null && minutes >= limit ? c.red : c.text2, fontSize: 13, fontWeight: '600' }}>
              {limit !== null && minutes >= limit ? t('ui.limitReached') : `${formatDuration(minutes, locale)}${limit !== null ? ` / ${formatDuration(limit, locale)}` : ''}`}
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
          {options.map((option) => {
            const selected = option === limit;
            const label = option === null ? t('ui.noLimit') : formatDuration(option, locale);
            return <Pressable key={String(option)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label}
              onPress={() => setDailyLimit(appId, option)}
              style={{ paddingHorizontal: 14, height: 38, borderRadius: 19, justifyContent: 'center', backgroundColor: selected ? undefined : c.card2, backgroundImage: selected ? c.grad : undefined }}>
              <Text style={{ color: selected ? '#FFFFFF' : c.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </Card>;
    })}
    <Note icon="info">{t('ui.dailyLimitsNote')}</Note>
  </Screen>;
}

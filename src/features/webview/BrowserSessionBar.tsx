import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';

/** Keep the ticking clock local so the WebView does not render every second. */
export function BrowserSessionBar({ active, visible, ads, suggested, filtered, onBlock, onLeave }: {
  active: boolean; visible: boolean; ads: number; suggested: number; filtered: boolean; onBlock: () => void; onLeave: () => void;
}) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(0);
  const elapsed = useRef(0);
  useEffect(() => {
    let since = active && AppState.currentState === 'active' ? Date.now() : null;
    const update = () => setSeconds(Math.floor((elapsed.current + (since === null ? 0 : Date.now() - since)) / 1000));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && active && since === null) since = Date.now();
      else if (state !== 'active' && since !== null) { elapsed.current += Date.now() - since; since = null; }
      update();
    });
    const timer = active ? setInterval(update, 1000) : null;
    update();
    return () => {
      if (since !== null) elapsed.current += Date.now() - since;
      if (timer) clearInterval(timer);
      subscription.remove();
    };
  }, [active]);
  if (!visible) return null;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <View style={styles.bar}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('browser.leave')} onPress={onLeave} style={styles.leave}>
      <Ionicons name="chevron-back" size={21} color="#A6A7AA" />
    </Pressable>
    <View accessible accessibilityLabel={t('browser.sessionSummary', { time, ads, suggested })} style={styles.summary}>
      <Ionicons name="stopwatch-outline" size={16} color="#A6A7AA" />
      <Text style={styles.timer}>{time}</Text>
      <Text style={styles.counts}>{t('browser.ads', { count: ads })} · {t('browser.suggested', { count: suggested })}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onBlock} style={({ pressed }) => [styles.block, filtered && styles.filtered, pressed && { opacity: 0.7 }]}>
      <Text style={styles.blockText}>{t(filtered ? 'browser.filtersOn' : 'browser.blockThese')}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#0C1013', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingRight: 14, paddingVertical: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#FFFFFF16' },
  leave: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 5, rowGap: 2, minWidth: 145 },
  timer: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  counts: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  block: { minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#009AF5', justifyContent: 'center' },
  filtered: { backgroundColor: '#284638' },
  blockText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});

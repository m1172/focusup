import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon, type IconName } from '../../components/Icon';
import { BackButton, toneColors, type TileTone } from '../../components/ui';
import { useAppTheme } from '../../theme';

/** Detail-page header shared by the Settings sub-pages: back button with a tinted icon medal on the same row, then the title and subtitle. */
export function PageHeader({ icon, tone = 'accent', title, subtitle, back = true }: { icon: IconName; tone?: TileTone; title: string; subtitle?: string; back?: boolean }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const colors = toneColors(c, tone);
  return <View style={{ gap: 14 }}>
    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {back ? <BackButton label={t('back')} /> : <View />}
      <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <Icon name={icon} size={25} color={colors.fg} strokeWidth={2} />
      </View>
    </View>
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 }}>{title}</Text>
      {subtitle ? <Text style={{ color: c.text2, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{subtitle}</Text> : null}
    </View>
  </View>;
}

/** White rounded panel with an optional small caps label above it. */
export function Panel({ label, children, padded = true }: PropsWithChildren<{ label?: string; padded?: boolean }>) {
  const c = useAppTheme();
  return <View style={{ gap: 8 }}>
    {label ? <Text style={{ marginLeft: 6, color: c.text3, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text> : null}
    <View style={{ borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, padding: padded ? 18 : 0, paddingHorizontal: padded ? 18 : 14, gap: padded ? 14 : 0 }}>{children}</View>
  </View>;
}

/** Tappable row inside a Panel (padded=false): tinted icon, title, optional subtitle/value, chevron. */
export function PanelRow({ icon, tone = 'accent', title, subtitle, value, right, onPress, last = false, danger = false }: { icon: IconName; tone?: TileTone; title: string; subtitle?: string; value?: string; right?: ReactNode; onPress?: () => void; last?: boolean; danger?: boolean }) {
  const c = useAppTheme();
  const colors = toneColors(c, danger ? 'red' : tone);
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.6 : 1 })}>
    <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><Icon name={icon} size={20} color={colors.fg} strokeWidth={2.1} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: danger ? c.red : c.text, fontSize: 16, lineHeight: 21, fontWeight: '700' }}>{title}</Text>
      {subtitle ? <Text numberOfLines={2} style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '500' }}>{subtitle}</Text> : null}
    </View>
    {value ? <Text numberOfLines={1} style={{ maxWidth: '40%', color: c.text2, fontSize: 14, fontWeight: '600' }}>{value}</Text> : null}
    {right}
    {onPress && !right ? <Icon name="chevron" size={18} color={c.text3} strokeWidth={2.2} /> : null}
  </Pressable>;
}

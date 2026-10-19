import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { FocusLogo } from '../../components/FocusLogo';

export function BrowserLaunchScreen({ name, onOpen, onOpenLink, onLeave }: {
  name: string; onOpen: () => void; onOpenLink: () => void; onLeave: () => void;
}) {
  const { t } = useTranslation();
  return <View style={styles.screen}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('browser.leave')} onPress={onLeave} style={styles.back}>
      <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
    </Pressable>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <FocusLogo size={84} />
        <Text accessibilityRole="header" style={styles.title}>{t('browser.launchTitle', { name })}</Text>
        <Text style={styles.body}>{t('browser.launchBody')}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onOpenLink} style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
          <Ionicons name="link-outline" size={20} color="#D8D1E1" /><Text style={styles.secondaryText}>{t('browser.openLink')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{t('browser.openApp', { name })}</Text><Ionicons name="arrow-forward" size={20} color="#32223F" />
        </Pressable>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#302538' },
  back: { width: 48, height: 48, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 48, justifyContent: 'space-between', gap: 60 },
  hero: { alignItems: 'center', gap: 20 },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  body: { color: '#B5ACBD', fontSize: 17, lineHeight: 25, textAlign: 'center' },
  actions: { alignSelf: 'center', width: '100%', maxWidth: 300, gap: 12 },
  button: { minHeight: 54, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondary: { backgroundColor: '#403B46', borderWidth: 1, borderColor: '#81738C' },
  primary: { backgroundColor: '#D7C3EA', borderWidth: 1, borderColor: '#EEE3F8' },
  secondaryText: { color: '#E0D9E7', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  primaryText: { color: '#32223F', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.75 },
});

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { normalizeSocialBrowserLink } from '../../services/social-browser/navigation';
import type { SocialAppId } from '../../types/app';
import { PostHogMaskView } from 'posthog-react-native';

export function BrowserLinkSheet({ appId, name, visible, onClose, onOpen }: {
  appId: SocialAppId; name: string; visible: boolean; onClose: () => void; onOpen: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    const url = normalizeSocialBrowserLink(appId, value);
    if (!url) { setInvalid(true); return; }
    onOpen(url); setValue(''); setInvalid(false); onClose();
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
      <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{t('browser.openLink')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>
        </View>
        <Text style={styles.body}>{t('browser.linkBody', { name })}</Text>
        <PostHogMaskView><TextInput autoFocus accessibilityLabel={t('browser.openLink')} value={value} onChangeText={(text) => { setValue(text); setInvalid(false); }}
          placeholder={t('browser.linkPlaceholder', { domain: appId === 'instagram' ? 'instagram.com' : 'youtube.com' })}
          placeholderTextColor="#9993A2" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={submit}
          selectionColor="#D7C3EA" style={styles.input} /></PostHogMaskView>
        {invalid ? <Text accessibilityRole="alert" style={styles.error}>{t('browser.invalidLink', { name })}</Text> : null}
        <Pressable accessibilityRole="button" disabled={!value.trim()} accessibilityState={{ disabled: !value.trim() }} onPress={submit} style={[styles.open, !value.trim() && { opacity: 0.5 }]}>
          <Text style={styles.openText}>{t('browser.openLink')}</Text>
        </Pressable>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#242129', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: '#B5ACBD' },
  input: { minHeight: 54, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#35313C', color: '#FFFFFF', fontSize: 16, borderWidth: 1, borderColor: '#65596F' },
  error: { color: '#FFABA6', fontSize: 14 },
  open: { minHeight: 52, borderRadius: 26, backgroundColor: '#D7C3EA', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  openText: { color: '#32223F', fontWeight: '700', fontSize: 17 },
});

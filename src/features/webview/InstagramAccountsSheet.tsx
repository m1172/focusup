import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Sheet } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { useInstagramAccountsStore } from '../../store/instagramAccountsStore';
import { canSwitchInstagramAccounts, MAX_INSTAGRAM_ACCOUNTS, removeInstagramAccount } from '../../services/social-browser/instagramAccounts';

/** Vaqtim's Instagram account switcher: each account keeps its own sign-in on this phone. */
export function InstagramAccountsSheet({ visible, onClose, onSwitch, onAdd, onManage }: {
  visible: boolean; onClose: () => void; onSwitch: (id: string) => void; onAdd: () => void; onManage: () => void;
}) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const slots = useInstagramAccountsStore((state) => state.slots);
  const activeId = useInstagramAccountsStore((state) => state.activeId);
  const [editing, setEditing] = useState(false);
  const available = canSwitchInstagramAccounts();
  const removable = slots.some((slot) => slot.id !== activeId);
  const close = () => { setEditing(false); onClose(); };
  const remove = (id: string, name: string) => Alert.alert(t('browser.removeAccount', { name }), t('browser.removeAccountBody'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('browser.remove'), style: 'destructive', onPress: () => { void removeInstagramAccount(id).then(() => { if (useInstagramAccountsStore.getState().slots.length < 2) setEditing(false); }); } },
  ]);

  if (!available) return <Sheet visible={visible} onClose={close} title={t('browser.switchAccount')} message={t('browser.accountsUnavailable')}>
    <Pressable accessibilityRole="button" onPress={() => { close(); onManage(); }} style={({ pressed }) => ({ minHeight: 52, borderRadius: 18, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{t('browser.manageAccount')}</Text>
    </Pressable>
  </Sheet>;

  return <Sheet visible={visible} onClose={close} title={t('browser.switchAccount')}>
    {removable ? <Pressable accessibilityRole="button" onPress={() => setEditing((value) => !value)} hitSlop={10} style={{ position: 'absolute', top: -44, right: 0, paddingVertical: 6, paddingHorizontal: 4 }}>
      <Text style={{ color: c.accent, fontSize: 16, fontWeight: '700' }}>{t(editing ? 'browser.doneEditing' : 'browser.editAccounts')}</Text>
    </Pressable> : null}
    <View style={{ borderRadius: 20, backgroundColor: c.card2, overflow: 'hidden' }}>
      {slots.map((slot, index) => {
        const active = slot.id === activeId;
        const name = slot.username ? `@${slot.username}` : t('browser.newAccount');
        return <Pressable key={slot.id} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: active }}
          onPress={() => { if (editing) { if (!active) remove(slot.id, name); return; } if (active) close(); else onSwitch(slot.id); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 66, paddingHorizontal: 14, borderTopWidth: index ? 1 : 0, borderTopColor: c.border, backgroundColor: pressed ? c.soft : 'transparent' })}>
          {slot.avatar ? <Image source={{ uri: slot.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} accessibilityIgnoresInvertColors />
            : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={22} color={c.ink} /></View>}
          <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '700' }}>{name}</Text>
          {editing ? (active ? null : <Ionicons name="remove-circle" size={24} color="#FF3B30" />)
            : active ? <Ionicons name="checkmark-circle" size={26} color="#34C759" /> : null}
        </Pressable>;
      })}
      {slots.length < MAX_INSTAGRAM_ACCOUNTS && !editing ? <Pressable accessibilityRole="button" onPress={onAdd}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingHorizontal: 14, borderTopWidth: slots.length ? 1 : 0, borderTopColor: c.border, backgroundColor: pressed ? c.soft : 'transparent' })}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.text3, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={24} color={c.text} /></View>
        <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '600' }}>{t('browser.addAccount')}</Text>
      </Pressable> : null}
    </View>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 }}>
      <Ionicons name="information-circle-outline" size={20} color={c.text2} />
      <Text style={{ flex: 1, color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '500' }}>{t('browser.accountsNote', { max: MAX_INSTAGRAM_ACCOUNTS })}</Text>
    </View>
  </Sheet>;
}

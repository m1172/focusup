import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Text } from '../components/Typography';
import { Icon } from '../components/Icon';
import { FocusLogo } from '../components/FocusLogo';
import { BackButton, BackgroundGlow } from '../components/ui';
import { ScreenStatusBar } from '../components/ScreenStatusBar';
import { useAppTheme } from '../theme';
import { useDiagnostics } from '../features/support/diagnostics';
import { useSupportChat } from '../features/support/useSupportChat';
import { dayLabel, threadRows, type ThreadRow } from '../features/support/thread';

const AVATAR = 28;
const TOPICS = ['topicReels', 'topicAccount', 'topicIdea'] as const;

function TeamAvatar({ size = AVATAR }: { size?: number }) {
  const c = useAppTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, boxShadow: c.sh, overflow: 'hidden' }}>
    <FocusLogo size={size * 0.78} glow={false} />
  </View>;
}

function DayChip({ day }: { day: Date }) {
  const c = useAppTheme(); const { t } = useTranslation();
  const label = dayLabel(day, new Date());
  return <View style={{ alignItems: 'center', marginVertical: 10 }}>
    <Text style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', backgroundColor: c.card2, color: c.text3, fontSize: 12, fontWeight: '700' }}>
      {label === 'today' ? t('supportChat.today') : label === 'yesterday' ? t('supportChat.yesterday') : label}
    </Text>
  </View>;
}

function Bubble({ sender, body, meta, groupEnd, faded = false }: { sender: 'user' | 'support'; body: string; meta?: ReactNode; groupEnd: boolean; faded?: boolean }) {
  const c = useAppTheme();
  const mine = sender === 'user';
  const tail = groupEnd ? 6 : 20;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8, marginBottom: groupEnd ? 14 : 3 }}>
    {!mine ? (groupEnd ? <TeamAvatar /> : <View style={{ width: AVATAR }} />) : null}
    <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start', gap: 4, opacity: faded ? 0.7 : 1 }}>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
        ...(mine ? { borderBottomRightRadius: tail, backgroundImage: c.grad } : { borderBottomLeftRadius: tail, backgroundColor: c.card, boxShadow: c.sh }),
      }}>
        <Text selectable style={{ color: mine ? '#FFFFFF' : c.text, fontSize: 16, lineHeight: 22, fontWeight: '500' }}>{body}</Text>
      </View>
      {meta}
    </View>
  </View>;
}

function MessageRow({ row, onRetry }: { row: Extract<ThreadRow, { kind: 'message' }>; onRetry: (localId: string) => void }) {
  const c = useAppTheme(); const { t } = useTranslation();
  const failed = row.pending?.state === 'failed';
  let meta: ReactNode = null;
  if (failed) {
    meta = <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onRetry(row.pending!.localId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="info" size={13} color={c.red} strokeWidth={2.4} />
      <Text style={{ color: c.red, fontSize: 12, fontWeight: '700' }}>{t('supportChat.failed')}</Text>
    </Pressable>;
  } else if (row.groupEnd) {
    meta = <Text style={{ color: c.text3, fontSize: 11, fontWeight: '600', marginHorizontal: 4 }}>{row.pending ? t('supportChat.sending') : row.time}</Text>;
  }
  return <Bubble sender={row.sender} body={row.body} groupEnd={row.groupEnd || failed} meta={meta} faded={row.pending?.state === 'sending'} />;
}

/** The top of the thread: who you're talking to, a greeting, and where messages go. */
function Intro() {
  const c = useAppTheme(); const { t } = useTranslation();
  return <View style={{ gap: 18, paddingTop: 8 }}>
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <TeamAvatar size={64} />
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 }}>{t('supportChat.team')}</Text>
        <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' }}>{t('supportChat.replyTime')}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: c.card2 }}>
        <Icon name="lock" size={13} color={c.text3} strokeWidth={2.2} />
        <Text style={{ flexShrink: 1, color: c.text3, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{t('supportChat.privacy')}</Text>
      </View>
    </View>
    <Bubble sender="support" body={t('supportChat.welcome')} groupEnd />
  </View>;
}

export default function SupportScreen() {
  const c = useAppTheme(); const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const diagnostics = useDiagnostics();
  const chat = useSupportChat(diagnostics);
  const [text, setText] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // The list is inverted so it opens at the newest message and grows upward.
  const rows = useMemo(() => threadRows(chat.messages, chat.pending, new Date()).reverse(), [chat.messages, chat.pending]);
  const empty = !chat.loading && rows.length === 0;
  const blocked = chat.problem === 'unavailable';
  const canSend = text.trim().length > 0 && !blocked;
  const submit = () => {
    if (!canSend) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    chat.send(text);
    setText('');
  };
  const notice = chat.problem ? t(`supportChat.${chat.problem}`) : null;

  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <ScreenStatusBar />
    <BackgroundGlow height={260} />
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: insets.top + 6, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <BackButton label={t('back')} />
        <View>
          <TeamAvatar size={40} />
          <View style={{ position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: c.bg, backgroundColor: c.mint }} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 }}>{t('supportChat.team')}</Text>
          <Text numberOfLines={1} style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{t('supportChat.replyTime')}</Text>
        </View>
      </View>

      <FlatList
        inverted
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => item.kind === 'day' ? <DayChip day={item.day} /> : <MessageRow row={item} onRetry={chat.retry} />}
        ListFooterComponent={<Intro />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1, justifyContent: 'flex-end' }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {notice ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: c.redSoft }}>
        <Icon name="info" size={16} color={c.red} strokeWidth={2.3} />
        <Text style={{ flex: 1, color: c.red, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{notice}</Text>
      </View> : null}

      {empty && !blocked && !text ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        {TOPICS.map((topic) => <Pressable key={topic} accessibilityRole="button" onPress={() => setText(t(`supportChat.${topic}`))} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: c.soft, backgroundColor: c.card, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: c.accent, fontSize: 14, fontWeight: '700' }}>{t(`supportChat.${topic}`)}</Text>
        </Pressable>)}
      </View> : null}

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: keyboard ? 10 : Math.max(insets.bottom, 12) }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingLeft: 18, padding: 6, borderRadius: 26, backgroundColor: c.card, boxShadow: c.sh, opacity: blocked ? 0.6 : 1 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            editable={!blocked}
            multiline
            maxLength={2000}
            placeholder={t('supportChat.placeholder')}
            placeholderTextColor={c.text3}
            accessibilityLabel={t('supportChat.placeholder')}
            style={{ flex: 1, minHeight: 40, maxHeight: 128, paddingTop: 10, paddingBottom: 10, color: c.text, fontSize: 16, lineHeight: 21, fontFamily: 'Manrope-500' }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t('supportChat.send')} accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={submit} style={({ pressed }) => ({
            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
            ...(canSend ? { backgroundImage: c.grad, boxShadow: c.sw } : { backgroundColor: c.off }),
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}>
            <Icon name="arrowUp" size={20} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </View>;
}

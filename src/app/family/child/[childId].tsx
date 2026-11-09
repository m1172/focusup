import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../components/Typography';
import { ActionButton, Note, Pill, Screen, Toggle } from '../../../components/ui';
import { PageHeader, Panel } from '../../../features/settings/components';
import { FamilyField } from '../../../features/family/components';
import { appNames, timeAgo } from '../../../features/family/format';
import { familyErrorMessage, runSensitive, useFamilyChild, useFamilyParentStore } from '../../../features/family/parentData';
import { childState, statusVariant } from '../../../features/family/status';
import { FamilyUsagePanel } from '../../../features/family/UsagePanel';
import { appCatalog } from '../../../features/apps/catalog';
import { accountApi } from '../../../services/backend/accountSession';
import { BackendError } from '../../../services/backend/client';
import { ageBand, ageOn, normalizePolicy, type BrowserApp, type FamilyDowntime, type FamilyPolicy } from '../../../services/family/policy';
import { ALL_PLATFORMS } from '../../../services/protection/engine';
import { useAppTheme } from '../../../theme';
import type { SocialAppId } from '../../../types/app';

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** Downtime closes the short-video apps and their Vaqtim versions; all-day blocks cover the rest. */
const DOWNTIME_APPS: SocialAppId[] = ['instagram', 'youtube', 'tiktok'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const LIMIT_OPTIONS = [null, 15, 30, 45, 60, 90, 120] as const;
const REFRESH_MS = 30_000;

/** Minutes a day in one clean browser; "No limit" removes it. */
function LimitPicker({ app, value, onChange }: { app: BrowserApp; value: number | null; onChange: (minutes: number | null) => void }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  return <View style={{ gap: 6, paddingLeft: 14 }}>
    <Text style={{ color: c.text2, fontSize: 14, fontWeight: '600' }}>{t('family.rules.limit')}</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {LIMIT_OPTIONS.map((option) => {
        const selected = option === value;
        const label = option === null ? t('family.rules.noLimit') : t('family.rules.minutes', { count: option });
        return <Pressable key={`${app}-${option}`} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} onPress={() => onChange(option)}
          style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.accent : c.card2 }}>
          <Text style={{ color: selected ? '#FFFFFF' : c.text2, fontSize: 13, fontWeight: '800' }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

function Row({ title, value, onChange, sub = false }: { title: string; value: boolean; onChange: (value: boolean) => void; sub?: boolean }) {
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: sub ? 14 : 0 }}>
    <Text style={{ flex: 1, color: sub ? c.text2 : c.text, fontSize: sub ? 14 : 16, lineHeight: 20, fontWeight: sub ? '600' : '700' }}>{title}</Text>
    <Toggle label={title} value={value} onChange={onChange} />
  </View>;
}

export default function FamilyChildScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useFamilyChild(childId);
  const load = useFamilyParentStore((state) => state.load);
  const replaceChild = useFamilyParentStore((state) => state.replaceChild);
  // Unsaved edits; until the parent changes something the saved rules are shown.
  const [edited, setEdited] = useState<FamilyPolicy | null>(null);
  // The rules revision an unsaved edit started from. A refresh in the background must not move it,
  // or saving would silently overwrite a change made on another parent phone.
  const [editedFrom, setEditedFrom] = useState<number | null>(null);
  const setDraft = (next: FamilyPolicy | null, from: number | null = null) => { setEdited(next); setEditedFrom(from); };
  const draft = edited ?? child?.policy.policy ?? null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Reload on open and every 30 s while open, so "Applied", last contact and usage stay current.
  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => { void load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]));
  const dirty = useMemo(() => Boolean(child && draft && JSON.stringify(draft) !== JSON.stringify(child.policy.policy)), [child, draft]);

  if (!child || !draft) return <Screen contentStyle={{ gap: 18 }}><PageHeader icon="shield" title={t('family.parent.title')} /></Screen>;
  const band = ageBand(child.birthDate);
  const state = childState(child);
  const report = child.device?.report ?? null;
  const update = (next: Partial<FamilyPolicy>) => { setMessage(null); setDraft({ ...draft, ...next }, editedFrom ?? child.policy.revision); };
  const setLimit = (app: BrowserApp, minutes: number | null) => {
    const limits = { ...draft.limits };
    if (minutes === null) delete limits[app]; else limits[app] = minutes;
    update({ limits });
  };
  const toggleApp = (app: SocialAppId, on: boolean) => update({ protectedApps: on ? [...draft.protectedApps, app] : draft.protectedApps.filter((item) => item !== app) });
  const setDowntime = (id: string, patch: Partial<FamilyDowntime>) => update({ downtime: draft.downtime.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const addDowntime = (kind: 'bedtime' | 'homework') => {
    if (draft.downtime.length >= 8) return;
    const id = `${kind}-${Date.now().toString(36)}`;
    const item: FamilyDowntime = kind === 'bedtime'
      ? { id, name: t('family.rules.bedtime'), start: '21:30', end: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6], apps: DOWNTIME_APPS }
      : { id, name: t('family.rules.homework'), start: '16:00', end: '18:00', weekdays: [1, 2, 3, 4, 5], apps: DOWNTIME_APPS };
    update({ downtime: [...draft.downtime, item] });
  };
  const timesValid = draft.downtime.every((item) => CLOCK.test(item.start) && CLOCK.test(item.end) && item.start !== item.end && item.weekdays.length > 0);

  const save = () => {
    if (!timesValid) return;
    setBusy(true);
    void accountApi().saveFamilyPolicy(child.id, editedFrom ?? child.policy.revision, normalizePolicy(draft, child.birthDate))
      .then((record) => { replaceChild({ id: child.id, policy: record }); setDraft(null); setMessage(t('family.rules.saved')); })
      .catch(async (error) => {
        if (error instanceof BackendError && error.code === 'FAMILY_REVISION_CONFLICT') {
          const latest = (await load())?.children.find((item) => item.id === child.id);
          if (latest) setDraft(null);
        }
        setMessage(familyErrorMessage(error));
      }).finally(() => setBusy(false));
  };
  const remove = () => Alert.alert(t('family.rules.removeTitle'), t('family.rules.removeBody', { name: child.nickname }), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('family.rules.removeSupervision'), style: 'destructive', onPress: () => {
      setBusy(true);
      void runSensitive(() => accountApi().removeFamilyChild(child.id)).then(async (result) => {
        if (!result) return;
        await load();
        if (result.state === 'removed') router.back();
      }).catch((error) => Alert.alert(t('family.rules.removeSupervision'), familyErrorMessage(error))).finally(() => setBusy(false));
    } },
  ]);

  const seen = child.device ? timeAgo(t, child.device.lastSeenAt) : null;
  return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="shield" tone="mint" title={child.nickname} subtitle={t('family.rules.age', { count: ageOn(child.birthDate) })} />

    <Panel label={t('family.rules.phone')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Pill label={t(`family.status.${state}`)} variant={statusVariant[state]} />
        <Text style={{ flexShrink: 1, color: c.text2, fontSize: 13, fontWeight: '600' }}>{seen ? t('family.parent.lastContact', { time: seen }) : t('family.parent.neverContacted')}</Text>
      </View>
      {child.removalPending ? <Text style={{ color: c.text2, fontSize: 14 }}>{t('family.rules.removePending')}</Text> : null}
      {report ? <Text style={{ color: report.authorized ? c.mintInk : c.red, fontSize: 14, fontWeight: '700' }}>{t(report.authorized ? 'family.rules.permissionsOk' : 'family.rules.permissionsMissing')}</Text> : null}
      {report?.platform === 'ios' && report.member === 'individual' ? <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.rules.notChildAccount')}</Text> : null}
      {report?.missingApps.length ? <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{t('family.rules.missingApps', { apps: appNames(report.missingApps) })}</Text> : null}
      {report?.platform === 'ios' && report.missingApps.length ? <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.rules.iosPickerNote')}</Text> : null}
      {report ? <Text style={{ color: c.text3, fontSize: 13 }}>{t('family.rules.timezone', { zone: report.timezone })}</Text> : null}
      {!child.device ? <Text style={{ color: c.text2, fontSize: 14 }}>{t('family.rules.noPhone')}</Text> : <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.rules.replaceBody')}</Text>}
      {!child.removalPending ? <ActionButton compact secondary title={t(child.device ? 'family.rules.replacePhone' : 'family.rules.pairPhone')} onPress={() => router.push({ pathname: '/family/pair/[childId]', params: { childId: child.id } })} /> : null}
    </Panel>

    {child.device && band !== 'child' ? <FamilyUsagePanel child={child} /> : null}

    {!child.removalPending ? <>
      <Panel label={t('family.rules.protectedApps')}>
        <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.rules.protectedAppsHint')}</Text>
        {ALL_PLATFORMS.map((app) => <Row key={app} title={appCatalog[app].name} value={draft.protectedApps.includes(app)} onChange={(on) => toggleApp(app, on)} />)}
      </Panel>

      <Panel label={t('family.rules.browsers')}>
        {band === 'child' ? <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.rules.browsersUnder13')}</Text> : <>
          <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.rules.browsersHint')}</Text>
          <Row title={t('family.rules.allow', { name: 'Instagram' })} value={Boolean(draft.browsers.instagram?.enabled)} onChange={(enabled) => update({ browsers: { ...draft.browsers, instagram: { followingFocus: true, hideSponsored: true, ...draft.browsers.instagram, enabled } } })} />
          {draft.browsers.instagram?.enabled ? <>
            <Row sub title={t('family.rules.instagramFollowing')} value={draft.browsers.instagram.followingFocus} onChange={(followingFocus) => update({ browsers: { ...draft.browsers, instagram: { ...draft.browsers.instagram!, followingFocus } } })} />
            <Row sub title={t('family.rules.instagramSponsored')} value={draft.browsers.instagram.hideSponsored} onChange={(hideSponsored) => update({ browsers: { ...draft.browsers, instagram: { ...draft.browsers.instagram!, hideSponsored } } })} />
            <Row sub title={t('family.rules.instagramStories')} value={Boolean(draft.browsers.instagram.hideStories)} onChange={(hideStories) => update({ browsers: { ...draft.browsers, instagram: { ...draft.browsers.instagram!, hideStories } } })} />
            <Row sub title={t('family.rules.instagramMessagesOnly')} value={Boolean(draft.browsers.instagram.messagesOnly)} onChange={(messagesOnly) => update({ browsers: { ...draft.browsers, instagram: { ...draft.browsers.instagram!, messagesOnly } } })} />
            <LimitPicker app="instagram" value={draft.limits?.instagram ?? null} onChange={(minutes) => setLimit('instagram', minutes)} />
          </> : null}
          <Row title={t('family.rules.allow', { name: 'YouTube' })} value={Boolean(draft.browsers.youtube?.enabled)} onChange={(enabled) => update({ browsers: { ...draft.browsers, youtube: { subscriptionsFocus: true, hideSponsored: true, hideComments: false, ...draft.browsers.youtube, enabled } } })} />
          {draft.browsers.youtube?.enabled ? <>
            <Row sub title={t('family.rules.youtubeSubscriptions')} value={draft.browsers.youtube.subscriptionsFocus} onChange={(subscriptionsFocus) => update({ browsers: { ...draft.browsers, youtube: { ...draft.browsers.youtube!, subscriptionsFocus } } })} />
            <Row sub title={t('family.rules.youtubeSponsored')} value={draft.browsers.youtube.hideSponsored} onChange={(hideSponsored) => update({ browsers: { ...draft.browsers, youtube: { ...draft.browsers.youtube!, hideSponsored } } })} />
            <Row sub title={t('family.rules.youtubeComments')} value={draft.browsers.youtube.hideComments} onChange={(hideComments) => update({ browsers: { ...draft.browsers, youtube: { ...draft.browsers.youtube!, hideComments } } })} />
            <Row sub title={t('family.rules.youtubeExplore')} value={Boolean(draft.browsers.youtube.hideExplore)} onChange={(hideExplore) => update({ browsers: { ...draft.browsers, youtube: { ...draft.browsers.youtube!, hideExplore } } })} />
            <LimitPicker app="youtube" value={draft.limits?.youtube ?? null} onChange={(minutes) => setLimit('youtube', minutes)} />
          </> : null}
          <Row title={t('family.rules.allow', { name: 'TikTok' })} value={Boolean(draft.browsers.tiktok?.enabled)} onChange={(enabled) => update({ browsers: { ...draft.browsers, tiktok: { followingFocus: true, ...draft.browsers.tiktok, enabled } } })} />
          {draft.browsers.tiktok?.enabled ? <>
            <Row sub title={t('family.rules.tiktokFollowing')} value={draft.browsers.tiktok.followingFocus} onChange={(followingFocus) => update({ browsers: { ...draft.browsers, tiktok: { ...draft.browsers.tiktok!, followingFocus } } })} />
            <LimitPicker app="tiktok" value={draft.limits?.tiktok ?? null} onChange={(minutes) => setLimit('tiktok', minutes)} />
          </> : null}
          <Text style={{ color: c.text3, fontSize: 12, lineHeight: 17 }}>{t('family.rules.limitHint')}</Text>
          <Text style={{ color: c.text3, fontSize: 12, lineHeight: 17 }}>{t('family.rules.adsNote')}</Text>
        </>}
      </Panel>

      <Panel label={t('family.rules.downtime')}>
        <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.rules.downtimeHint')}</Text>
        {draft.downtime.map((item) => <View key={item.id} style={{ gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{item.name}</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => update({ downtime: draft.downtime.filter((other) => other.id !== item.id) })}><Text style={{ color: c.red, fontSize: 14, fontWeight: '700' }}>{t('family.rules.removeDowntime')}</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <FamilyField label={t('family.rules.start')} value={item.start} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={(start) => setDowntime(item.id, { start })} />
            <FamilyField label={t('family.rules.end')} value={item.end} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={(end) => setDowntime(item.id, { end })} />
          </View>
          <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {WEEK.map((day) => {
              const on = item.weekdays.includes(day);
              const label = (t('family.weekdays', { returnObjects: true }) as string[])[day]!;
              return <Pressable key={day} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => setDowntime(item.id, { weekdays: on ? item.weekdays.filter((value) => value !== day) : [...item.weekdays, day].sort() })}
                style={{ minWidth: 40, height: 36, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : c.card2 }}>
                <Text style={{ color: on ? '#FFFFFF' : c.text2, fontSize: 13, fontWeight: '800' }}>{label}</Text>
              </Pressable>;
            })}
          </View>
        </View>)}
        {draft.downtime.length < 8 ? <View style={{ flexDirection: 'row', gap: 10 }}>
          <ActionButton compact secondary style={{ flex: 1 }} title={`+ ${t('family.rules.bedtime')}`} onPress={() => addDowntime('bedtime')} />
          <ActionButton compact secondary style={{ flex: 1 }} title={`+ ${t('family.rules.homework')}`} onPress={() => addDowntime('homework')} />
        </View> : null}
      </Panel>

      {message ? <Note tone={message === t('family.rules.saved') ? 'mint' : 'amber'} icon="info">{message}</Note> : null}
      <ActionButton title={t('family.rules.save')} disabled={!dirty || !timesValid || busy} onPress={save} />
    </> : null}
    <ActionButton variant="destructive" title={t('family.rules.removeSupervision')} disabled={busy || child.removalPending} onPress={remove} />
  </Screen>;
}

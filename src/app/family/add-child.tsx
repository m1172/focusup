import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { ActionButton, Note, Screen } from '../../components/ui';
import { PageHeader, Panel } from '../../features/settings/components';
import { FamilyField } from '../../features/family/components';
import { familyErrorMessage, useFamilyParentStore } from '../../features/family/parentData';
import { accountApi } from '../../services/backend/accountSession';
import { ageOn, isBirthDate } from '../../services/family/policy';
import { useAppTheme } from '../../theme';

const digits = (value: string, length: number) => value.replace(/\D/g, '').slice(0, length);

export default function AddChildScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const overview = useFamilyParentStore((state) => state.overview);
  const load = useFamilyParentStore((state) => state.load);
  const [nickname, setNickname] = useState('');
  const [day, setDay] = useState(''), [month, setMonth] = useState(''), [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const birthDate = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const complete = nickname.trim().length > 0 && day.length > 0 && month.length > 0 && year.length === 4;
  const validDate = complete && isBirthDate(birthDate) && new Date(`${birthDate}T00:00:00`) <= new Date();
  const age = validDate ? ageOn(birthDate) : null;
  const error = complete && !validDate ? t('family.addChild.invalidDate') : age !== null && age >= 18 ? t('family.addChild.tooOld') : null;

  const add = () => {
    if (!overview || !validDate || error) return;
    setBusy(true);
    void accountApi().addFamilyChild(nickname.trim(), birthDate, overview.consentVersion)
      .then(async (child) => { await load(); router.replace({ pathname: '/family/child/[childId]', params: { childId: child.id } }); })
      .catch((failure) => Alert.alert(t('family.addChild.title'), familyErrorMessage(failure))).finally(() => setBusy(false));
  };

  return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="plus" tone="accent" title={t('family.addChild.title')} subtitle={t('family.addChild.subtitle')} />
    <Panel>
      <FamilyField label={t('family.addChild.nickname')} placeholder={t('family.addChild.nicknamePlaceholder')} value={nickname} onChangeText={(value) => setNickname(value.slice(0, 40))} autoCapitalize="words" autoCorrect={false} textContentType="none" autoComplete="off" />
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800', marginTop: 4 }}>{t('family.addChild.birthDate')}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <FamilyField label={t('family.addChild.day')} placeholder="15" keyboardType="number-pad" value={day} onChangeText={(value) => setDay(digits(value, 2))} maxLength={2} />
        <FamilyField label={t('family.addChild.month')} placeholder="03" keyboardType="number-pad" value={month} onChangeText={(value) => setMonth(digits(value, 2))} maxLength={2} />
        <FamilyField label={t('family.addChild.year')} placeholder="2013" keyboardType="number-pad" value={year} onChangeText={(value) => setYear(digits(value, 4))} maxLength={4} />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: c.red, fontSize: 14, fontWeight: '600' }}>{error}</Text> : null}
    </Panel>
    {age !== null && age < 13 ? <Note tone="mint" icon="info">{t('family.addChild.under13')}</Note> : null}
    <ActionButton title={t('family.addChild.add')} disabled={!validDate || Boolean(error) || busy} onPress={add} />
  </Screen>;
}

import { useEffect } from 'react';
import { Button, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import i18n from '../i18n';
import { captureAppException, initializeProductAnalytics } from '../services/analytics/productAnalytics';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { void initializeProductAnalytics().then(() => captureAppException(error, 'react_error_boundary')); }, [error]);
  return <View style={{ flex: 1, padding: 24, gap: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
    <Text accessibilityRole="alert" style={{ fontSize: 18, textAlign: 'center', color: '#161616' }}>{i18n.t('observability.error')}</Text>
    <Button title={i18n.t('observability.retry')} onPress={retry} />
  </View>;
}

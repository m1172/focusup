import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { accountApi } from './accountSession';
import { BackendError } from './client';

export async function exportAccountFile() {
  const data = await accountApi().exportAccount();
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'focusup-account.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new BackendError(0, 'SHARING_UNAVAILABLE', 'File sharing is unavailable on this device.');
  const file = new File(Paths.cache, 'focusup-account.json');
  try {
    await file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
  } finally { if (file.exists) file.delete(); }
}

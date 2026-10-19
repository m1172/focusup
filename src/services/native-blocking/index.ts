import { Platform } from 'react-native';
import { androidNativeBlocker } from './androidNativeBlocker';
import { expoFallbackBlocker } from './expoFallback';
import { iosNativeBlocker } from './iosNativeBlocker';

export * from './types';
export { expoFallbackBlocker } from './expoFallback';
export const nativeAppBlocker = Platform.OS === 'ios'
  ? iosNativeBlocker
  : Platform.OS === 'android' ? androidNativeBlocker : expoFallbackBlocker;

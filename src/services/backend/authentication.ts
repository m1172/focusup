import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { BackendError } from './client';
import { accountApi, accountSession } from './accountSession';
import { oauthSecretStorage } from './secretStorage';
import { OAuthFlow } from './oauthFlow';
import type { Credentials, OAuthProvider } from './types';

export async function randomNonce() { return Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
export function authRedirectUrl() { return Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : 'focusup://auth/callback'; }
let flow: OAuthFlow | null = null;
export function oauthFlow() {
  if (!flow) flow = new OAuthFlow({
    origin: process.env.EXPO_PUBLIC_API_URL?.trim() ?? '', redirectUrl: authRedirectUrl(), storage: oauthSecretStorage(),
    createProof: async () => {
      const verifier = await randomNonce();
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
      return { verifier, challenge: digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
    },
    start: (provider, challenge) => accountApi().startOAuth(provider, challenge),
    exchange: (code, verifier) => accountApi().exchangeOAuth(code, verifier),
    accept: (session, generation) => accountSession.accept(session, false, generation),
    generation: () => {
      if (accountSession.getState().user) throw new BackendError(401, 'SESSION_CHANGED', 'Already signed in.');
      return accountSession.beginAuthentication();
    },
  });
  return flow;
}
export async function signInWithProvider(provider: OAuthProvider) {
  await accountSession.initialize();
  const url = await oauthFlow().begin(provider);
  if (Platform.OS === 'web') { window.location.assign(url); return; }
  try {
    const result = await WebBrowser.openAuthSessionAsync(url, authRedirectUrl());
    if (result.type === 'success') await oauthFlow().complete(result.url);
    else { await oauthFlow().cancel(); throw new BackendError(0, 'AUTH_CANCELLED', 'Sign-in was cancelled.'); }
  } catch (error) { await oauthFlow().cancel(); throw error; }
}
export async function signInWithApple() {
  await accountSession.initialize();
  const generation = accountSession.beginAuthentication();
  const nonce = await randomNonce();
  // Apple carries the hash in the ID token; Supabase checks the original nonce.
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce: hashedNonce });
  if (!credential.identityToken) throw new BackendError(401, 'AUTH_FAILED', 'Apple did not return an identity token.');
  const session = await accountApi().signInWithIdToken('apple', credential.identityToken, nonce);
  await accountSession.accept(session, false, generation);
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').slice(0, 80);
  if (name) { try { await accountApi().saveProfile(name); } catch { /* Account is signed in; name can be entered later. */ } }
}
export async function signInWithEmail(credentials: Credentials) {
  await accountSession.initialize(); const generation = accountSession.beginAuthentication();
  await accountSession.accept(await accountApi().signIn(credentials), false, generation);
}
export async function registerWithEmail(credentials: Credentials) {
  await accountSession.initialize(); const generation = accountSession.beginAuthentication();
  const result = await accountApi().signUp(credentials);
  if (result.session) await accountSession.accept(result.session, false, generation);
  return result.confirmationRequired;
}
export async function verifyEmailCode(email: string, token: string, type: 'signup' | 'recovery') {
  await accountSession.initialize(); const generation = accountSession.beginAuthentication();
  await accountSession.accept(await accountApi().verifyCode(email, token, type), type === 'recovery', generation);
}
export async function updatePassword(password: string) {
  await accountApi().changePassword(password);
  await accountSession.finishRecovery();
}

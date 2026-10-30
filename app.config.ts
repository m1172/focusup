import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Vaqtim',
  slug: config.slug ?? 'focusup',
  plugins: [
    ...(config.plugins ?? []),
    // Upload hooks require build-time credentials. Unconfigured/local builds must
    // still work. CLI secrets never enter expo.extra or the public JS bundle.
    ...(process.env.POSTHOG_CLI_API_KEY && process.env.POSTHOG_CLI_PROJECT_ID
      ? [['posthog-react-native/expo', { uploadNativeSymbols: true, skipOnConflict: true }] as [string, Record<string, boolean>]]
      : []),
  ],
});

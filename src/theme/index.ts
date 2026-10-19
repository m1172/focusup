import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/appStore';
import type { SocialAppId } from '../types/app';

/**
 * Design tokens, copied 1:1 from the FocusUp Light / Dark design canvases.
 * Gradients and shadows are CSS strings: React Native 0.88 renders `backgroundImage`
 * and `boxShadow` natively, so they match the design exactly on iOS, Android and web.
 */
export type DesignTokens = {
  bg: string; card: string; card2: string;
  text: string; text2: string; text3: string;
  accent: string; ink: string; soft: string;
  mint: string; mintInk: string; mintSoft: string;
  blue: string; blueSoft: string;
  red: string; redSoft: string;
  amber: string; amberSoft: string;
  line: string; off: string; island: string; onHero: string;
  /** Apple sign-in button: dark on light UI, light on dark UI */
  appleBg: string; appleFg: string;
  nav: string; seg: string; segOn: string;
  grad: string; hero: string; bgGlow: string;
  sh: string; glow: string; sw: string; heroSh: string; navSh: string; knobSh: string; segSh: string; sheetSh: string;
  planSh: string;
  /** Hero card decoration */
  heroOrb: string; heroBar: string; heroBarGlow: string; heroChip: string; heroIconBg: string;
  /** 1px rings dark mode adds around tinted surfaces ('' in light) */
  ringSoft: string; ringMint: string; ringBlue: string;
  /** Uniform glow behind the splash logo / strict-mode lock */
  logoHalo: string; lockHalo: string;
  apps: Record<SocialAppId, { ink: string; bg: string; label: string }>;
};

export type AppPalette = DesignTokens & {
  isDark: boolean;
  /* Legacy aliases kept for secondary screens. */
  background: string; surface: string; surfaceSecondary: string; muted: string; faint: string;
  primary: string; primarySoft: string; success: string; successSoft: string; danger: string; dangerSoft: string;
  border: string; chart: string; shadow: string;
  primaryGradient: readonly [string, string]; cardGradient: readonly [string, string];
};

const light: DesignTokens = {
  bg: '#F7F8FC', card: '#FFFFFF', card2: '#F0F1F8',
  text: '#0E1020', text2: '#5A5F76', text3: '#9096AC',
  accent: '#5B50F0', ink: '#4338CA', soft: '#EEEDFF',
  mint: '#12B886', mintInk: '#0A7F5F', mintSoft: '#E1F7EE',
  blue: '#3D7BFF', blueSoft: '#E8F0FF',
  red: '#C92A35', redSoft: '#FDECEC',
  amber: '#8A5A00', amberSoft: '#FFF3D6',
  line: 'rgba(14,16,32,0.07)', off: '#D8DAE6', island: '#05060A', onHero: 'rgba(255,255,255,0.82)',
  appleBg: '#0E1020', appleFg: '#FFFFFF',
  nav: 'rgba(255,255,255,0.88)', seg: '#ECEEF6', segOn: '#FFFFFF',
  grad: 'linear-gradient(135deg, #6558F5 0%, #4338CA 100%)',
  hero: 'linear-gradient(150deg, #6558F5 0%, #4B40E0 55%, #3A32C4 100%)',
  bgGlow: 'radial-gradient(60% 100% at 50% 0%, rgba(110,98,255,0.14), rgba(110,98,255,0) 70%)',
  sh: '0px 1px 2px rgba(24,28,70,0.04), 0px 10px 28px rgba(24,28,70,0.07)',
  glow: '0px 10px 24px rgba(79,70,229,0.30)',
  sw: '0px 2px 8px rgba(79,70,229,0.30)',
  heroSh: '0px 18px 40px rgba(79,70,229,0.28)',
  navSh: '0px 1px 2px rgba(24,28,70,0.05), 0px 12px 32px rgba(24,28,70,0.12)',
  knobSh: '0px 1px 3px rgba(0,0,0,0.25)',
  segSh: '0px 1px 3px rgba(20,24,60,0.12)',
  sheetSh: '0px -10px 30px rgba(24,28,70,0.12)',
  planSh: '0px 10px 24px rgba(79,70,229,0.18)',
  heroOrb: 'radial-gradient(closest-side, rgba(255,255,255,0.2), rgba(255,255,255,0))',
  heroBar: 'rgba(255,255,255,0.28)', heroBarGlow: '0px 0px 24px rgba(255,255,255,0.35)',
  heroChip: 'rgba(255,255,255,0.16)', heroIconBg: 'rgba(255,255,255,0.18)',
  ringSoft: '', ringMint: '', ringBlue: '',
  logoHalo: '', lockHalo: 'radial-gradient(closest-side, rgba(110,98,255,0.18), rgba(110,98,255,0))',
  apps: {
    instagram: { ink: '#C2255C', bg: '#FDEBF2', label: 'Ig' },
    youtube: { ink: '#C92A35', bg: '#FDECEC', label: 'Yt' },
    tiktok: { ink: '#0B7285', bg: '#E3F5F8', label: 'Tk' },
    x: { ink: '#343A46', bg: '#ECEEF3', label: 'X' },
    reddit: { ink: '#C2410C', bg: '#FFEFE5', label: 'Rd' },
    snapchat: { ink: '#8A7100', bg: '#FFF8CC', label: 'Sc' },
    facebook: { ink: '#1864AB', bg: '#E8F0FF', label: 'Fb' },
    linkedin: { ink: '#1864AB', bg: '#E8F0FF', label: 'In' },
  },
};

const dark: DesignTokens = {
  bg: '#080B12', card: '#121722', card2: '#1A2030',
  text: '#F2F4FA', text2: '#A3A9BD', text3: '#6C7289',
  accent: '#8277FF', ink: '#A9A2FF', soft: '#1B1A3A',
  mint: '#34D3A0', mintInk: '#5FE3B8', mintSoft: '#0F2A25',
  blue: '#6C9CFF', blueSoft: '#14223F',
  red: '#FF6B75', redSoft: '#2E161B',
  amber: '#F5C451', amberSoft: '#33270B',
  line: 'rgba(255,255,255,0.07)', off: '#2B3144', island: '#000000', onHero: 'rgba(255,255,255,0.80)',
  appleBg: '#F2F4FA', appleFg: '#080B12',
  nav: 'rgba(18,23,34,0.82)', seg: '#161B28', segOn: '#2A3248',
  grad: 'linear-gradient(135deg, #6A5EF7 0%, #4B3FD8 100%)',
  hero: 'linear-gradient(150deg, #5B4FEA 0%, #3F34C4 55%, #2A2494 100%)',
  bgGlow: 'radial-gradient(60% 100% at 50% 0%, rgba(110,98,255,0.22), rgba(110,98,255,0) 70%)',
  sh: '0px 0px 0px 1px rgba(255,255,255,0.055), 0px 14px 32px rgba(0,0,0,0.40)',
  glow: '0px 10px 28px rgba(106,94,247,0.40)',
  sw: '0px 0px 12px rgba(130,119,255,0.45)',
  heroSh: '0px 20px 48px rgba(79,67,224,0.35), 0px 0px 0px 1px rgba(255,255,255,0.08)',
  navSh: '0px 0px 0px 1px rgba(255,255,255,0.07), 0px 16px 36px rgba(0,0,0,0.55)',
  knobSh: '0px 1px 3px rgba(0,0,0,0.5)',
  segSh: '0px 1px 3px rgba(0,0,0,0.5)',
  sheetSh: '0px -10px 30px rgba(0,0,0,0.5)',
  planSh: '0px 10px 28px rgba(106,94,247,0.28)',
  heroOrb: 'radial-gradient(closest-side, rgba(160,150,255,0.30), rgba(160,150,255,0))',
  heroBar: 'rgba(255,255,255,0.24)', heroBarGlow: '0px 0px 28px rgba(190,182,255,0.55)',
  heroChip: 'rgba(255,255,255,0.14)', heroIconBg: 'rgba(255,255,255,0.16)',
  ringSoft: '0px 0px 0px 1px rgba(130,119,255,0.2)', ringMint: '0px 0px 0px 1px rgba(52,211,160,0.18)', ringBlue: '0px 0px 0px 1px rgba(108,156,255,0.16)',
  logoHalo: 'radial-gradient(closest-side, rgba(106,94,247,0.28), rgba(106,94,247,0))',
  lockHalo: 'radial-gradient(closest-side, rgba(106,94,247,0.34), rgba(106,94,247,0))',
  apps: {
    instagram: { ink: '#FF7AA8', bg: '#341826', label: 'Ig' },
    youtube: { ink: '#FF6B75', bg: '#341A1F', label: 'Yt' },
    tiktok: { ink: '#4FD1E6', bg: '#12303A', label: 'Tk' },
    x: { ink: '#C9CEDA', bg: '#232938', label: 'X' },
    reddit: { ink: '#FF8F5C', bg: '#3A2218', label: 'Rd' },
    snapchat: { ink: '#F5D547', bg: '#332D0D', label: 'Sc' },
    facebook: { ink: '#6C9CFF', bg: '#14223F', label: 'Fb' },
    linkedin: { ink: '#6C9CFF', bg: '#14223F', label: 'In' },
  },
};

function withAliases(t: DesignTokens, isDark: boolean): AppPalette {
  return {
    ...t,
    isDark,
    background: t.bg, surface: t.card, surfaceSecondary: t.card2, muted: t.text2, faint: t.text3,
    primary: t.accent, primarySoft: t.soft, success: t.mintInk, successSoft: t.mintSoft,
    danger: t.red, dangerSoft: t.redSoft, border: t.line, chart: t.accent, shadow: isDark ? '#000000' : '#181C46',
    primaryGradient: isDark ? ['#6A5EF7', '#4B3FD8'] as const : ['#6558F5', '#4338CA'] as const,
    cardGradient: isDark ? ['#5B4FEA', '#2A2494'] as const : ['#6558F5', '#3A32C4'] as const,
  };
}

export const palettes: Record<'light' | 'dark', AppPalette> = {
  light: withAliases(light, false),
  dark: withAliases(dark, true),
};

/** Joins shadow layers, skipping empty ones (e.g. light-mode rings). */
export function shadows(...layers: (string | false | undefined)[]): string {
  return layers.filter(Boolean).join(', ');
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;

export function useAppTheme(): AppPalette {
  const mode = useAppStore((state) => state.themeMode);
  const system = useColorScheme();
  return mode === 'system' ? (system === 'dark' ? palettes.dark : palettes.light) : palettes[mode];
}

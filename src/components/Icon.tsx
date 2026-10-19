import type { ReactElement } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Stroke icons drawn on a 24×24 grid, path-for-path from the FocusUp design. */
const glyphs = {
  back: <Path d="M15 5l-7 7 7 7" />,
  chevron: <Path d="M9 5l7 7-7 7" />,
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <Path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  shield: <Path d="M12 3.5l7 2.6v5.6c0 4.4-2.9 7.4-7 8.8-4.1-1.4-7-4.4-7-8.8V6.1z" />,
  shieldCheck: <><Path d="M12 3.5l7 2.6v5.6c0 4.4-2.9 7.4-7 8.8-4.1-1.4-7-4.4-7-8.8V6.1z" /><Path d="M8.8 12l2.3 2.3 4.2-4.4" /></>,
  circleCheck: <><Circle cx="12" cy="12" r="8.5" /><Path d="M8.5 12.2l2.5 2.5 4.5-5" /></>,
  bell: <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0" />,
  sparkles: <Path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />,
  sparkle: <Path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />,
  home: <Path d="M4 11.2 12 4.6l8 6.6V19a1.5 1.5 0 0 1-1.5 1.5H15V15H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" />,
  apps: <><Rect x="4" y="4" width="6.5" height="6.5" rx="2" /><Rect x="13.5" y="4" width="6.5" height="6.5" rx="2" /><Rect x="4" y="13.5" width="6.5" height="6.5" rx="2" /><Rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" /></>,
  stats: <Path d="M5 20v-7M12 20V5M19 20v-10" />,
  sliders: <><Path d="M4 7h8M18 7h2M4 17h2M12 17h8" /><Circle cx="15" cy="7" r="2.5" /><Circle cx="9" cy="17" r="2.5" /></>,
  reels: <><Rect x="4" y="4" width="16" height="16" rx="4.5" /><Path d="M10 9v6l5-3z" /></>,
  shorts: <><Rect x="7" y="3.5" width="10" height="17" rx="3.5" /><Path d="M11 9.5v5l4-2.5z" /></>,
  explore: <><Circle cx="12" cy="12" r="8.5" /><Path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  layers: <Path d="M4 7l8-3.5L20 7l-8 3.5zM4 12l8 3.5 8-3.5M4 16.5L12 20l8-3.5" />,
  plusSquare: <><Rect x="4" y="4" width="16" height="16" rx="4" /><Path d="M12 8.5v7M8.5 12h7" /></>,
  feed: <><Rect x="4" y="4" width="16" height="16" rx="4" /><Path d="M8 9h8M8 12.5h8M8 16h5" /></>,
  megaphone: <Path d="M4 10v4h3l7 4V6L7 10zM17.5 9.5a4 4 0 0 1 0 5" />,
  comment: <Path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5z" />,
  lock: <><Rect x="5" y="10.5" width="14" height="10" rx="3" /><Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  lockDot: <><Rect x="5" y="10.5" width="14" height="10" rx="3" /><Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><Circle cx="12" cy="15.5" r="1.2" fill="currentColor" /></>,
  clock: <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.5V12l3 2" /></>,
  briefcase: <><Rect x="4" y="8" width="16" height="11" rx="3" /><Path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" /></>,
  moon: <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  book: <><Path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" /><Path d="M12 6v13.5" /></>,
  run: <><Circle cx="14.5" cy="5" r="1.8" /><Path d="M8 20l3-6 3.5 2V21M11 14l-1-4.5 4.5-1.5 2.5 3.5 3 .5M10 9.5L6.5 11" /></>,
  globe: <><Circle cx="12" cy="12" r="8.5" /><Path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5C9.5 18 8.5 15 8.5 12s1-6 3.5-8.5z" /></>,
  contrast: <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 3.5v17" /><Path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" /></>,
  target: <><Circle cx="12" cy="12" r="8.5" /><Circle cx="12" cy="12" r="4" /><Circle cx="12" cy="12" r=".8" fill="currentColor" /></>,
  help: <><Circle cx="12" cy="12" r="8.5" /><Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 16.5v.1" /></>,
  info: <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 11v5.5M12 7.7v.1" /></>,
  search: <><Circle cx="11" cy="11" r="6.5" /><Path d="M16 16l4 4" /></>,
  calendar: <><Rect x="4" y="5.5" width="16" height="14.5" rx="3.5" /><Path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  key: <><Circle cx="8.5" cy="12" r="4" /><Path d="M12.5 12H20M17 12v3M20 12v2.5" /></>,
  mail: <><Rect x="3.5" y="5.5" width="17" height="13" rx="3" /><Path d="M4.5 7.5l7.5 5.5 7.5-5.5" /></>,
  eye: <><Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><Circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><Circle cx="12" cy="12" r="3" /><Path d="M4 4l16 16" /></>,
  cloud: <Path d="M7.5 18.5h9.5a4 4 0 0 0 .55-7.96A5.5 5.5 0 0 0 7 10.03 4.25 4.25 0 0 0 7.5 18.5z" />,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof glyphs;

export function Icon({ name, size = 24, color, strokeWidth = 1.9 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} color={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {glyphs[name]}
    </Svg>
  );
}

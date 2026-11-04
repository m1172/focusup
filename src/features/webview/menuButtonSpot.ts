import type { MenuButtonSpot } from '../../store/browserMenuStore';

export const MENU_BUTTON_SIZE = 58;
/** Gap kept between the button and the screen edges (beyond the safe area). */
const EDGE = 12;
/** Where the button sat before it could be moved: 16 pt from the right, 78 pt above the bottom inset. */
const DEFAULT_RIGHT = 16;
const DEFAULT_BOTTOM = 78;

export type Area = { width: number; height: number };
export type Insets = { top: number; bottom: number; left: number; right: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

/** The rectangle the button's top-left corner may move in: inside the safe area, never off screen. */
export function menuButtonBounds(area: Area, insets: Insets): Bounds {
  const minX = insets.left + EDGE, minY = insets.top + EDGE;
  return {
    minX, minY,
    maxX: Math.max(minX, area.width - insets.right - EDGE - MENU_BUTTON_SIZE),
    maxY: Math.max(minY, area.height - insets.bottom - EDGE - MENU_BUTTON_SIZE),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The button's top-left corner for a saved spot, or the default bottom-right spot. */
export function menuButtonPoint(spot: MenuButtonSpot | null, area: Area, insets: Insets): { left: number; top: number } {
  const b = menuButtonBounds(area, insets);
  if (!spot) return {
    left: clamp(area.width - insets.right - DEFAULT_RIGHT - MENU_BUTTON_SIZE, b.minX, b.maxX),
    top: clamp(area.height - insets.bottom - DEFAULT_BOTTOM - MENU_BUTTON_SIZE, b.minY, b.maxY),
  };
  return { left: b.minX + clamp(spot.x, 0, 1) * (b.maxX - b.minX), top: b.minY + clamp(spot.y, 0, 1) * (b.maxY - b.minY) };
}

/** Keeps a dragged point inside the bounds. */
export function clampMenuButtonPoint(point: { left: number; top: number }, area: Area, insets: Insets) {
  const b = menuButtonBounds(area, insets);
  return { left: clamp(point.left, b.minX, b.maxX), top: clamp(point.top, b.minY, b.maxY) };
}

/** The spot to save for where the user let go. */
export function menuButtonSpotFor(point: { left: number; top: number }, area: Area, insets: Insets): MenuButtonSpot {
  const b = menuButtonBounds(area, insets);
  const { left, top } = clampMenuButtonPoint(point, area, insets);
  return { x: b.maxX > b.minX ? (left - b.minX) / (b.maxX - b.minX) : 0, y: b.maxY > b.minY ? (top - b.minY) / (b.maxY - b.minY) : 0 };
}

import { clampMenuButtonPoint, MENU_BUTTON_SIZE, menuButtonPoint, menuButtonSpotFor } from '../menuButtonSpot';

const phone = { width: 402, height: 874 };
const insets = { top: 62, bottom: 34, left: 0, right: 0 };

describe('Browser menu button position', () => {
  it('starts bottom right, where it always was', () => {
    expect(menuButtonPoint(null, phone, insets)).toEqual({ left: 402 - 16 - MENU_BUTTON_SIZE, top: 874 - 34 - 78 - MENU_BUTTON_SIZE });
  });

  it('can be put anywhere: corners, edges and the middle', () => {
    expect(menuButtonPoint({ x: 0, y: 0 }, phone, insets)).toEqual({ left: 12, top: 62 + 12 });
    expect(menuButtonPoint({ x: 1, y: 1 }, phone, insets)).toEqual({ left: 402 - 12 - MENU_BUTTON_SIZE, top: 874 - 34 - 12 - MENU_BUTTON_SIZE });
    expect(menuButtonPoint({ x: 0.5, y: 0.5 }, phone, insets).left + MENU_BUTTON_SIZE / 2).toBeCloseTo(201);
  });

  it('never goes off screen or under the status bar and home indicator', () => {
    expect(clampMenuButtonPoint({ left: -200, top: -200 }, phone, insets)).toEqual({ left: 12, top: 74 });
    expect(clampMenuButtonPoint({ left: 5000, top: 5000 }, phone, insets)).toEqual({ left: 332, top: 770 });
  });

  it('keeps the same spot after the screen size changes (rotation, iPad split view)', () => {
    const spot = menuButtonSpotFor({ left: 12, top: 400 }, phone, insets);
    const point = menuButtonPoint(spot, { width: 874, height: 402 }, { top: 0, bottom: 21, left: 62, right: 62 });
    expect(point.left).toBe(62 + 12);
    expect(point.top).toBeGreaterThanOrEqual(12);
    expect(point.top).toBeLessThanOrEqual(402 - 21 - 12 - MENU_BUTTON_SIZE);
    expect(menuButtonSpotFor(menuButtonPoint(spot, phone, insets), phone, insets)).toEqual(spot);
  });
});

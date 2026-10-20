/**
 * The launch screen at an address of its own. "/" is shared by this splash and the Home tab
 * ((tabs)/index), so guard redirects to "/" could land on the guarded Home tab and bounce forever.
 */
export { default } from './index';

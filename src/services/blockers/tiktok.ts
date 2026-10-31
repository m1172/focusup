import type { BlockerScriptGenerator } from './types';
import { generateTikTokBlockingScript as generateTikTokScript } from './tiktok/index';

export { TIKTOK_BASE_URL, defaultTikTokBlockerConfig, normalizeTikTokBlockerConfig, isBlockedTikTokNavigation, isTikTokHost, isTikTokVideoUrl, tiktokFeedFeature, tiktokSelectors } from './tiktok/index';
export { generateTikTokBlockingScript as createTikTokBlockingScript } from './tiktok/index';
export const generateTikTokBlockingScript: BlockerScriptGenerator = ({ enabled, filters }) => generateTikTokScript(filters, enabled);

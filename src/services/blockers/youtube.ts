import type { BlockerScriptGenerator } from './types';
import { generateYouTubeBlockingScript as generateYouTubeScript, youtubeSelectors } from './youtube/index';

export { youtubeSelectors };
export { YOUTUBE_BASE_URL, defaultYouTubeBlockerConfig, normalizeYouTubeBlockerConfig, sponsoredContentBlockerStatus, isBlockedYouTubeNavigation, isHomeYouTubeUrl, isWatchYouTubeUrl, isYouTubeShortsUrl } from './youtube/index';
export { generateYouTubeBlockingScript as createYouTubeBlockingScript } from './youtube/index';
export const generateYouTubeBlockingScript: BlockerScriptGenerator = ({ enabled, filters }) => generateYouTubeScript(filters, enabled);

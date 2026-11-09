import type { BlockerScriptGenerator } from './types';
import { generateInstagramBlockingScript as generateInstagramScript } from './instagram/index';

export { instagramBlockedPage, instagramSelectors, instagramStartUrl, isBlockedInstagramNavigation, isInstagramAuthenticationUrl } from './instagram/index';
export const generateInstagramBlockingScript: BlockerScriptGenerator = ({ enabled, filters }) => generateInstagramScript(filters, enabled);

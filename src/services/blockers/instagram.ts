import type { BlockerScriptGenerator } from './types';
import { generateInstagramBlockingScript as generateInstagramScript } from './instagram/index';

export { instagramSelectors, isBlockedInstagramNavigation, isInstagramAuthenticationUrl } from './instagram/index';
export const generateInstagramBlockingScript: BlockerScriptGenerator = ({ enabled, filters }) => generateInstagramScript(filters, enabled);

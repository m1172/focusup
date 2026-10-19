import type { SocialAppId } from '../../types/app';
import type { BlockerScriptGenerator } from './types';
import { generateInstagramBlockingScript } from './instagram';
import { generateYouTubeBlockingScript } from './youtube';

const generators: Partial<Record<SocialAppId, BlockerScriptGenerator>> = {
  instagram: generateInstagramBlockingScript,
  youtube: generateYouTubeBlockingScript,
};

export function generateBlockingScript(appId: SocialAppId, enabled: boolean, filters: Record<string, boolean>): string | null {
  const generate = generators[appId];
  return generate ? generate({ appId, enabled, filters }) : null;
}

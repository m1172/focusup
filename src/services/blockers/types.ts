import type { SocialAppId } from '../../types/app';
export type { InstagramBlockerConfig, InstagramFilterFeature, InstagramWebViewEvent, YouTubeBlockerConfig, YouTubeFilterFeature, YouTubeWebViewEvent, SocialWebViewEvent } from '../../types/social';

export type BlockerScriptInput = { appId: SocialAppId; enabled: boolean; filters: Record<string, boolean> };
export type BlockerScriptGenerator = (input: BlockerScriptInput) => string;

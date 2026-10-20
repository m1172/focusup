const { getPostHogExpoConfig } = require('posthog-react-native/metro');

// Preserve Expo's Metro defaults and add debug IDs for PostHog source maps.
module.exports = getPostHogExpoConfig(__dirname);

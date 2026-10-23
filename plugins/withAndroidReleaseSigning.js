const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

// Signs local release builds (./gradlew app:bundleRelease) with the Play upload key.
// The keystore and passwords stay outside the repo, in ~/.gradle/gradle.properties:
//   FOCUSUP_UPLOAD_STORE_FILE=/absolute/path/to/focusup-upload.keystore
//   FOCUSUP_UPLOAD_KEY_ALIAS=focusup-upload
//   FOCUSUP_UPLOAD_STORE_PASSWORD=...
//   FOCUSUP_UPLOAD_KEY_PASSWORD=...
// Without them, release builds keep the template's debug signing (installable, never accepted by Play).
const MARKER = '// @focusup/release-signing';

const signingConfig = `        release { ${MARKER}
            if (findProperty('FOCUSUP_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('FOCUSUP_UPLOAD_STORE_FILE'))
                storePassword findProperty('FOCUSUP_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('FOCUSUP_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('FOCUSUP_UPLOAD_KEY_PASSWORD')
            }
        }
`;

function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const debugConfig = /(signingConfigs\s*\{\s*\n\s*debug\s*\{[^}]*\}\n)/;
  const releaseUsesDebug = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!debugConfig.test(gradle) || !releaseUsesDebug.test(gradle)) {
    throw new Error('withAndroidReleaseSigning: android/app/build.gradle no longer matches the expected template; update the plugin.');
  }
  return gradle
    .replace(debugConfig, `$1${signingConfig}`)
    .replace(releaseUsesDebug, "$1signingConfig findProperty('FOCUSUP_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug");
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('withAndroidReleaseSigning: expected a Groovy build.gradle.');
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents);
    return mod;
  });
}

module.exports = createRunOncePlugin(withAndroidReleaseSigning, 'focusup-android-release-signing', '1.0.0');
module.exports.addReleaseSigning = addReleaseSigning;

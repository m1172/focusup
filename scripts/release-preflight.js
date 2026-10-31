// Stops a store build that would ship with development settings. Run by `npm run release:check`.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const problems = [];
const warnings = [];

const envFile = path.join(root, '.env.production');
const env = {};
if (!fs.existsSync(envFile)) problems.push('.env.production is missing (copy .env.production.example).');
else for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
}

if (env.EXPO_PUBLIC_APP_ENV !== 'production') problems.push('EXPO_PUBLIC_APP_ENV must be "production" in .env.production.');
for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_PRIVACY_POLICY_URL']) {
  if (!env[key]) problems.push(`${key} is empty in .env.production.`);
  else if (!env[key].startsWith('https://')) problems.push(`${key} must be an https:// URL.`);
}
if (/SECRET|SERVICE_ROLE/i.test(Object.keys(env).join(' '))) problems.push('.env.production contains a secret-looking key; only public values belong there.');

const release = fs.readFileSync(path.join(root, 'src/config/release.ts'), 'utf8');
if (/TEMP_FORCE_PRO\s*:\s*boolean\s*=\s*true/.test(release)) problems.push('TEMP_FORCE_PRO is on in src/config/release.ts: everyone would get Pro for free.');
const proEnabled = /PRO_ENABLED\s*:\s*boolean\s*=\s*true/.test(release);
if (proEnabled && (!env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || !env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY)) {
  problems.push('PRO_ENABLED is true but the RevenueCat keys are empty in .env.production.');
}

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const gradleProps = path.join(require('os').homedir(), '.gradle', 'gradle.properties');
const signing = fs.existsSync(gradleProps) && /^FOCUSUP_UPLOAD_STORE_FILE=/m.test(fs.readFileSync(gradleProps, 'utf8'));
if (!signing) warnings.push('No Android upload key in ~/.gradle/gradle.properties: the .aab will be debug-signed and Google Play will reject it.');

console.log(`Vaqtim ${app.version} (iOS build ${app.ios.buildNumber}, Android versionCode ${app.android.versionCode}), Pro ${proEnabled ? 'on' : 'off'}`);
warnings.forEach((w) => console.warn(`warning: ${w}`));
if (problems.length) {
  problems.forEach((p) => console.error(`error: ${p}`));
  process.exit(1);
}
console.log('Release settings look ready.');

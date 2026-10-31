// Raises the store build numbers in app.json before every upload (the stores reject a number they have seen).
// Usage: npm run release:bump            -> next build of the same version
//        npm run release:bump -- 1.0.1   -> new user-visible version, next build
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(file, 'utf8'));
const version = process.argv[2];
if (version && !/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Version must look like 1.0.1, got "${version}".`);

if (version) app.expo.version = version;
app.expo.ios.buildNumber = String(Number(app.expo.ios.buildNumber ?? '0') + 1);
app.expo.android.versionCode = (app.expo.android.versionCode ?? 0) + 1;
fs.writeFileSync(file, `${JSON.stringify(app, null, 2)}\n`);
console.log(`Vaqtim ${app.expo.version}: iOS build ${app.expo.ios.buildNumber}, Android versionCode ${app.expo.android.versionCode}`);

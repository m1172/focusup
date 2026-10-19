const { withEntitlementsPlist, withInfoPlist, withXcodeProject, withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist');

const extensions = [
  { name: 'FocusUpMonitor', point: 'com.apple.deviceactivity.monitor-extension', files: ['ProtectionShared.swift', 'FocusUpMonitor.swift'] },
  { name: 'FocusUpShield', point: 'com.apple.ManagedSettingsUI.shield-configuration-service', files: ['ProtectionShared.swift', 'FocusUpShield.swift'] },
  { name: 'FocusUpShieldAction', point: 'com.apple.ManagedSettings.shield-action-service', files: ['FocusUpShieldAction.swift'] },
  { name: 'FocusUpLiveActivity', point: 'com.apple.widgetkit-extension', files: ['FocusUpActivityAttributes.swift', 'FocusUpLiveActivity.swift'] },
];
function withFocusUpProtection(config) {
  const bundle = config.ios?.bundleIdentifier;
  if (!bundle) throw new Error('FocusUp protection requires ios.bundleIdentifier');
  const group = `group.${bundle}.protection`;
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.family-controls'] = true;
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...(mod.modResults['com.apple.security.application-groups'] ?? []), group])];
    return mod;
  });
  config = withInfoPlist(config, (mod) => { mod.modResults.FocusUpAppGroup = group; mod.modResults.NSSupportsLiveActivities = true; return mod; });
  config = withDangerousMod(config, ['ios', async (mod) => {
    const root = mod.modRequest.projectRoot;
    const source = path.join(root, 'modules/focusup-protection');
    for (const ext of extensions) {
      const directory = path.join(mod.modRequest.platformProjectRoot, ext.name);
      fs.mkdirSync(directory, { recursive: true });
      for (const file of ext.files) fs.copyFileSync(path.join(source, fs.existsSync(path.join(source, 'ios', file)) ? 'ios' : 'extensions', file), path.join(directory, file));
      if (ext.files.includes('ProtectionShared.swift') || ext.name === 'FocusUpShieldAction') fs.copyFileSync(path.join(source, 'ios/PrivacyInfo.xcprivacy'), path.join(directory, 'PrivacyInfo.xcprivacy'));
      else fs.writeFileSync(path.join(directory, 'PrivacyInfo.xcprivacy'), plist.default.build({ NSPrivacyTracking: false, NSPrivacyCollectedDataTypes: [], NSPrivacyAccessedAPITypes: [] }));
      const extension = { NSExtensionPointIdentifier: ext.point };
      if (ext.name !== 'FocusUpLiveActivity') extension.NSExtensionPrincipalClass = `$(PRODUCT_MODULE_NAME).${ext.name}`;
      fs.writeFileSync(path.join(directory, 'Info.plist'), plist.default.build({ CFBundleDisplayName: 'FocusUp', CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: 'XPC!', CFBundleShortVersionString: config.version ?? '1.0.0', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)', FocusUpAppGroup: group, NSExtension: extension, ...(ext.name === 'FocusUpLiveActivity' ? { NSSupportsLiveActivities: true } : {}) }));
      fs.writeFileSync(path.join(directory, `${ext.name}.entitlements`), plist.default.build({ 'com.apple.security.application-groups': [group], ...(ext.name === 'FocusUpLiveActivity' ? {} : { 'com.apple.developer.family-controls': true }) }));
    }
    return mod;
  }]);
  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const main = project.getFirstTarget().firstTarget;
    const mainConfigurations = project.pbxXCConfigurationList()[main.buildConfigurationList].buildConfigurations;
    const mainSettings = project.pbxXCBuildConfigurationSection()[mainConfigurations[0].value].buildSettings;
    for (const ext of extensions) {
      const existing = Object.entries(project.pbxNativeTargetSection()).find(([, target]) => typeof target === 'object' && target.name?.replace(/"/g, '') === ext.name);
      const target = existing ? { uuid: existing[0], pbxNativeTarget: existing[1] } : project.addTarget(ext.name, 'app_extension', ext.name, `${bundle}.${ext.name}`);
      if (!existing) {
        const filePaths = ext.files.map((file) => `${ext.name}/${file}`);
        project.addBuildPhase(filePaths, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
        project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      }
      if (!target.pbxNativeTarget.buildPhases.some((phase) => phase.comment === 'Resources')) project.addBuildPhase([`${ext.name}/PrivacyInfo.xcprivacy`], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      // Build phases create file references, but do not put them in the project tree.
      // CocoaPods resolves privacy manifests through their parent group.
      const groups = project.hash.project.objects.PBXGroup;
      const existingGroup = Object.entries(groups).find(([, item]) => typeof item === 'object' && item.name?.replace(/"/g, '') === ext.name);
      const groupId = existingGroup?.[0] ?? project.addPbxGroup([], ext.name, '.').uuid;
      const mainGroupId = project.getFirstProject().firstProject.mainGroup;
      if (!groups[mainGroupId].children.some((child) => child.value === groupId)) project.addToPbxGroup(groupId, mainGroupId);
      for (const [fileRef, file] of Object.entries(project.pbxFileReferenceSection())) {
        if (typeof file !== 'object' || !file.path?.replace(/"/g, '').startsWith(`${ext.name}/`)) continue;
        const hasParent = Object.values(groups).some((item) => typeof item === 'object' && item.children?.some((child) => child.value === fileRef));
        if (!hasParent) project.addToPbxGroup({ fileRef, basename: path.basename(file.path.replace(/"/g, '')) }, groupId);
      }
      const configurations = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList].buildConfigurations;
      for (const item of configurations) Object.assign(project.pbxXCBuildConfigurationSection()[item.value].buildSettings, {
        INFOPLIST_FILE: `"${ext.name}/Info.plist"`, CODE_SIGN_ENTITLEMENTS: `"${ext.name}/${ext.name}.entitlements"`, SWIFT_VERSION: '5.9', IPHONEOS_DEPLOYMENT_TARGET: '16.4', TARGETED_DEVICE_FAMILY: '"1,2"', APPLICATION_EXTENSION_API_ONLY: 'YES', GENERATE_INFOPLIST_FILE: 'NO', CURRENT_PROJECT_VERSION: config.ios?.buildNumber ?? mainSettings.CURRENT_PROJECT_VERSION ?? '1', ...(mainSettings.DEVELOPMENT_TEAM ? { DEVELOPMENT_TEAM: mainSettings.DEVELOPMENT_TEAM } : {}), MARKETING_VERSION: `"${config.version ?? '1.0.0'}"`,
      });
    }
    return mod;
  });
  config.extra ??= {}; config.extra.eas ??= {}; config.extra.eas.build ??= {}; config.extra.eas.build.experimental ??= {}; config.extra.eas.build.experimental.ios ??= {};
  config.extra.eas.build.experimental.ios.appExtensions = [...(config.extra.eas.build.experimental.ios.appExtensions ?? []).filter((item) => !extensions.some((ext) => ext.name === item.targetName)), ...extensions.map((ext) => ({ targetName: ext.name, bundleIdentifier: `${bundle}.${ext.name}`, entitlements: { 'com.apple.security.application-groups': [group], ...(ext.name === 'FocusUpLiveActivity' ? {} : { 'com.apple.developer.family-controls': true }) } }))];
  return config;
}
module.exports = createRunOncePlugin(withFocusUpProtection, 'focusup-protection', '1.0.0');

Pod::Spec.new do |s|
  s.name = 'FocusUpProtection'
  s.version = '1.0.0'
  s.summary = 'Local FocusUp Screen Time integration'
  s.description = 'User-authorized FamilyControls selection, ManagedSettings shields and DeviceActivity timers.'
  s.author = 'FocusUp'
  s.homepage = 'https://expo.dev'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.{swift,h,m}'
  s.resource_bundles = { 'FocusUpProtectionPrivacy' => ['PrivacyInfo.xcprivacy'] }
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'ActivityKit', 'SwiftUI', 'WebKit'
  s.swift_version = '5.9'
end

/* eslint-disable @typescript-eslint/no-require-imports -- config plugins are CommonJS. */
type Manifest = { manifest: { $: Record<string, string>; application: { receiver?: { $: Record<string, string> }[]; 'meta-data'?: { $: Record<string, string> }[] }[] } };
type Mod = (input: { modResults: Manifest; modRequest: object }) => Promise<{ modResults: Manifest }>;
type Plugin = (config: object, options: object) => { mods: { android: { manifest: Mod } } };

const run = async (plugin: Plugin, options: object) => {
  const config = plugin({ name: 'Vaqtim', slug: 'focusup' }, options);
  const manifest: Manifest = { manifest: { $: {}, application: [{}] } };
  return (await config.mods.android.manifest({ modResults: manifest, modRequest: { platform: 'android' } })).modResults.manifest.application[0]!;
};

describe('Android config plugins for Family and widgets', () => {
  it('declares the parental-control monitoring flag only when switched on', async () => {
    const plugin = require('../withMonitoringTool') as Plugin;
    expect((await run(plugin, { enabled: false }))['meta-data']).toEqual([]);
    expect((await run(plugin, { enabled: true }))['meta-data']).toEqual([{ $: { 'android:name': 'android.app.isMonitoringTool', 'android:value': 'child_monitoring' } }]);
  });

  it('adds the quick-launch widget receiver only when switched on', async () => {
    const plugin = require('../withQuickLaunchWidget') as Plugin;
    expect((await run(plugin, { enabled: false })).receiver).toEqual([]);
    const receivers = (await run(plugin, { enabled: true })).receiver ?? [];
    expect(receivers.map((item) => item.$['android:name'])).toEqual(['expo.modules.focusupprotection.FocusUpQuickLaunchWidget']);
  });

  it('ships both switched off in app.json', () => {
    const plugins = (require('../../app.json') as { expo: { plugins: (string | [string, Record<string, unknown>])[] } }).expo.plugins;
    const options = (name: string) => (plugins.find((item) => Array.isArray(item) && item[0] === name) as [string, Record<string, unknown>])[1];
    expect(options('./plugins/withMonitoringTool').enabled).toBe(false);
    expect(options('./plugins/withQuickLaunchWidget').enabled).toBe(false);
    expect(options('./plugins/withFocusUpProtection').quickLaunchWidget).toBe(false);
  });
});

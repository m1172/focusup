const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['node_modules/**', 'work/**', 'backend/**', 'supabase/**', 'website/**'] },
]);

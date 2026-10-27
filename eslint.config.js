// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Function berjalan di Deno, bukan di app.
    ignores: ['dist/*', 'supabase/functions/**', '.scratch/**', 'backups/**'],
  },
]);

/** @type {import("prettier").Config} */
export default {
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: false,
  trailingComma: 'all',

  plugins: ['@ianvs/prettier-plugin-sort-imports'],

  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '^@pudim/(.*)$',
    '^#(bot|pudim)/(.*)$',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '6.0.3',
  importOrderCaseSensitive: false,
}

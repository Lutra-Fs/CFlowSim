import biome from 'eslint-config-biome';
import { includeIgnoreFile } from '@eslint/compat';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import react from '@eslint-react/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  // Include gitignore patterns
  includeIgnoreFile(path.join(__dirname, '.gitignore')),

  // Base JS rules
  js.configs.recommended,

  // Biome - disables ESLint rules that Biome covers
  biome,

  // TypeScript-specific rules that Biome doesn't cover
  ...tseslint.configs.recommendedTypeChecked,

  // React rules from @eslint-react/eslint-plugin
  {
    files: ['**/*.{ts,tsx}'],
    ...react.configs.recommended,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
  },

  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Preserve existing custom rules
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowNullish: true },
      ],

      // React Fast Refresh (not in Biome or eslint-react)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Import rules (not in Biome)
      'import/no-named-as-default': 'off',
    },
  },
  {
    ignores: ['dist', 'node_modules', 'src/workers/**/*'],
  },
];

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'out/**'],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // docs/architecture.md — `any` proibido; use `unknown` + narrowing.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // docs/security.md — logs nunca por console; use o logger (allowlist de campos).
      'no-console': 'error',

      // docs/security.md §22 — process.env só em src/config/env.ts.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.object.name="process"][object.property.name="env"]',
          message:
            'Nao leia process.env diretamente. Use src/config/env.ts (ver docs/security.md).',
        },
      ],
    },
  },

  // A camada de configuracao e o unico lugar que enxerga process.env.
  {
    files: ['src/config/env.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // O logger e o unico lugar que fala com o console.
  {
    files: ['src/lib/logging/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  // Configuracao de build roda fora do type-check do app.
  {
    files: ['*.mjs', '*.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  /*
   * `headers()` e `redirects()` do Next precisam devolver Promise por contrato
   * de API, mesmo sem nada para aguardar. Exigir `await` aqui seria exigir
   * codigo pior. Excecao restrita a este arquivo.
   */
  {
    files: ['next.config.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },

  /*
   * Testes precisam montar e derrubar o ambiente para provar que a camada de
   * config se comporta com integracao ausente — e literalmente o que
   * tests/unit/env.test.ts verifica. A regra continua valendo para todo o
   * codigo de aplicacao, que e onde ela protege.
   */
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  prettier,
)

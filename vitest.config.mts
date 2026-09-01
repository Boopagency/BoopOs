import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
}

/**
 * Duas suites, propositos diferentes.
 *
 *   unit  roda em qualquer lugar, em segundos, sem infraestrutura.
 *   rls   roda contra um Postgres DE VERDADE. Nunca contra dublê: um mock de
 *         RLS testaria o mock ([ADR-0015](docs/adr/0015-testes-de-rls-contra-postgres-real.md)).
 *
 * `pnpm test` roda as duas. Se a suite `rls` nao encontrar banco, ela FALHA
 * com instrucao — nao pula em silencio (.claude/rules/testing.md).
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/component/**/*.test.{ts,tsx}'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'rls',
          environment: 'node',
          globals: true,
          include: ['tests/rls/**/*.test.ts'],
          // Um pool por arquivo mantém cada caso independente da ordem.
          fileParallelism: false,
        },
      },
    ],
  },
})

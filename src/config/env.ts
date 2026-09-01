/**
 * Camada unica de acesso a environment. Nenhum outro arquivo le `process.env`
 * (regra aplicada pelo ESLint). Ver docs/security.md.
 *
 * Duas categorias, deliberadamente separadas:
 *
 *   1. REQUIRED NOW      — validado no import. Falta disso quebra o app, e deve.
 *   2. REQUIRED WHEN ON  — validado apenas quando a integracao e usada.
 *
 * Consequencia pratica: `pnpm dev` e `pnpm build` funcionam com Supabase,
 * Resend e Notion ausentes. Uma integracao so exige suas variaveis no momento
 * em que alguem tenta usa-la, com mensagem dizendo o que falta.
 */
import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/* 1. Required now                                                            */
/* -------------------------------------------------------------------------- */

const coreSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  /* Distingue preview de producao — NODE_ENV vale 'production' nos dois. */
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
})

/**
 * Referencia literal a cada variavel publica: o Next substitui
 * `process.env.NEXT_PUBLIC_*` em tempo de build apenas quando encontra o
 * acesso escrito por extenso. Indexacao dinamica nao funcionaria no browser.
 */
const coreParsed = coreSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
})

if (!coreParsed.success) {
  throw new Error(
    `Environment invalido:\n${z.prettifyError(coreParsed.error)}\n\nVer .env.example.`,
  )
}

export const env = coreParsed.data

export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/* -------------------------------------------------------------------------- */
/* 2. Required when enabled                                                   */
/* -------------------------------------------------------------------------- */

class MissingIntegrationEnvError extends Error {
  constructor(integration: string, missing: string[]) {
    super(
      `Integracao "${integration}" nao esta configurada. Variaveis ausentes: ` +
        `${missing.join(', ')}. Ver .env.example e docs/deployment.md.`,
    )
    this.name = 'MissingIntegrationEnvError'
  }
}

function readAll(vars: Record<string, string | undefined>) {
  const missing = Object.entries(vars)
    .filter(([, value]) => value === undefined || value === '')
    .map(([key]) => key)
  return { missing, values: vars }
}

/** Snapshot cru das integracoes. Nunca exportado para fora deste modulo. */
function supabaseVars() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

function resendVars() {
  return { RESEND_API_KEY: process.env.RESEND_API_KEY }
}

function notionVars() {
  return { NOTION_API_KEY: process.env.NOTION_API_KEY }
}

/**
 * Configuracao publica do Supabase. Lanca com mensagem acionavel se faltar.
 * Passa a ser usado de verdade na FASE 3.
 */
export function requireSupabaseEnv() {
  const { missing, values } = readAll(supabaseVars())
  if (missing.length > 0) throw new MissingIntegrationEnvError('supabase', missing)
  return {
    url: values.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: values.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  }
}

/**
 * Chave de service role. NUNCA chame isto fora de src/lib/supabase/admin.ts.
 * Ignora toda a RLS. Ver docs/security.md.
 */
export function requireSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new MissingIntegrationEnvError('supabase-admin', ['SUPABASE_SERVICE_ROLE_KEY'])
  return key
}

/** FASE 5. */
export function requireResendEnv() {
  const { missing, values } = readAll(resendVars())
  if (missing.length > 0) throw new MissingIntegrationEnvError('resend', missing)
  return { apiKey: values.RESEND_API_KEY as string }
}

/** FASE 17. */
export function requireNotionEnv() {
  const { missing, values } = readAll(notionVars())
  if (missing.length > 0) throw new MissingIntegrationEnvError('notion', missing)
  return { apiKey: values.NOTION_API_KEY as string }
}

/* -------------------------------------------------------------------------- */
/* 3. Diagnostico                                                             */
/* -------------------------------------------------------------------------- */

export type IntegrationName = 'supabase' | 'resend' | 'notion'

/**
 * Booleans para o painel de desenvolvimento. Devolve apenas configured/nao —
 * NUNCA o valor de nenhuma variavel. Ver docs/security.md.
 */
export function integrationStatus(): Record<IntegrationName, boolean> {
  return {
    supabase: readAll(supabaseVars()).missing.length === 0,
    resend: readAll(resendVars()).missing.length === 0,
    notion: readAll(notionVars()).missing.length === 0,
  }
}

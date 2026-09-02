/**
 * Conexao com um Postgres DE VERDADE.
 *
 * Nada aqui usa o cliente do Supabase, e isso e proposital. O cliente fala com
 * PostgREST, que ja aplica autorizacao; testar por ele seria testar a camada
 * errada. Aqui abrimos uma conexao direta e assumimos identidades no proprio
 * banco, que e onde a RLS decide
 * ([ADR-0015](../../../docs/adr/0015-testes-de-rls-contra-postgres-real.md)).
 */
import { Client, type QueryResult, type QueryResultRow } from 'pg'

/**
 * Mesma porta do `supabase start` e do plano B sem Docker
 * (`scripts/db/local-postgres.sh`), entao a string nao muda com o ambiente.
 */
const DEFAULT_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export function databaseUrl(): string {
  // `SUPABASE_DB_URL` e o nome ja documentado na matriz de variaveis
  // (docs/deployment.md). Nao inventamos um segundo.
  return process.env.SUPABASE_DB_URL ?? DEFAULT_URL
}

const NO_DATABASE = `
Nenhum Postgres em ${databaseUrl()}.

  Com Docker:   supabase start
  Sem Docker:   pnpm db:start   (scripts/db/local-postgres.sh — nao e Supabase)
  Depois:       pnpm db:reset

Esta suite nao pula quando falta banco. Um teste de isolamento que "passa"
sem banco nao prova nada (.claude/rules/testing.md).
`.trim()

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl() })
  try {
    await client.connect()
  } catch (cause) {
    await client.end().catch(() => {})
    throw new Error(NO_DATABASE, { cause })
  }
  return client
}

/** Identidades que a suite assume. Os nomes espelham docs/permissions.md. */
export type Identity =
  { kind: 'anonymous' } | { kind: 'service_role' } | { kind: 'user'; userId: string }

export const ANONYMOUS: Identity = { kind: 'anonymous' }
export const SERVICE_ROLE: Identity = { kind: 'service_role' }
export const asUser = (userId: string): Identity => ({ kind: 'user', userId })

/**
 * Executa dentro de uma transacao que SEMPRE termina em rollback.
 *
 * Duas razoes: o banco volta identico depois de cada caso, e `set local`
 * garante que a identidade assumida nao vaza para o proximo teste. Um caso que
 * so passa em certa ordem esta errado (.claude/rules/testing.md).
 */
export async function withIdentity<T>(
  client: Client,
  identity: Identity,
  run: (tx: Tx) => Promise<T>,
): Promise<T> {
  await client.query('begin')
  try {
    switch (identity.kind) {
      case 'anonymous':
        await client.query('set local role anon')
        break
      case 'service_role':
        // Bypassa RLS por definicao. Serve para PREPARAR estado, nunca para
        // provar isolamento — a prova tem que vir de um papel comum.
        await client.query('set local role service_role')
        break
      case 'user':
        await client.query('set local role authenticated')
        await client.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify({ sub: identity.userId, role: 'authenticated' }),
        ])
        break
    }

    return await run(makeTx(client))
  } finally {
    await client.query('rollback')
  }
}

/**
 * Transacao com rollback, SEM assumir papel nenhum: roda como o dono do banco.
 *
 * Serve para o que e mecanica do Postgres e nao caminho da aplicacao — o
 * espelho de `auth.users`, por exemplo, que nem `service_role` tem privilegio
 * para mexer (nem no Supabase hospedado). Nao use para testar autorizacao:
 * dono de tabela nao sofre RLS, entao aqui nada se prova sobre isolamento.
 */
export async function withRollback<T>(client: Client, run: (tx: Tx) => Promise<T>): Promise<T> {
  await client.query('begin')
  try {
    return await run(makeTx(client))
  } finally {
    await client.query('rollback')
  }
}

export interface Tx {
  query<R extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>
  /** Roda a query e devolve o erro do Postgres em vez de lancar. */
  expectError(sql: string, params?: unknown[]): Promise<PgError>
}

export interface PgError {
  code: string
  message: string
}

function makeTx(client: Client): Tx {
  return {
    query: (sql, params) => client.query(sql, params),
    async expectError(sql, params) {
      // Savepoint: sem ele, a transacao ficaria abortada e os passos seguintes
      // do mesmo caso falhariam por tabela, nao pela regra sob teste.
      await client.query('savepoint expect_error')
      try {
        await client.query(sql, params)
      } catch (error) {
        await client.query('rollback to savepoint expect_error')
        const pg = error as { code?: string; message?: string }
        return { code: pg.code ?? 'unknown', message: pg.message ?? String(error) }
      }
      await client.query('rollback to savepoint expect_error')
      throw new Error(`esperava erro do Postgres, mas a query passou:\n${sql}`)
    },
  }
}

/**
 * Troca de identidade DENTRO de uma transacao ja aberta.
 *
 * Existe para um caso especifico e legitimo: preparar estado como
 * `service_role` e depois provar a regra como usuario comum, sem sair da
 * transacao — porque sair dela e perder o rollback, e o estado preparado
 * vazaria para o proximo caso.
 *
 * Isso NAO enfraquece a regra de que `service_role` nao testa RLS
 * (.claude/rules/testing.md): o papel privilegiado monta o cenario, a operacao
 * sob teste roda como `authenticated`. Quem prova continua sendo o papel comum.
 */
export async function switchIdentity(tx: Tx, identity: Identity): Promise<void> {
  /* `reset role` primeiro: `authenticated` e `noinherit` e nao pode assumir
   * outro papel por conta propria. Quem pode e o usuario da sessao. */
  await tx.query('reset role')

  switch (identity.kind) {
    case 'anonymous':
      await tx.query('set local role anon')
      await tx.query('select set_config($1, $2, true)', ['request.jwt.claims', ''])
      break
    case 'service_role':
      await tx.query('set local role service_role')
      await tx.query('select set_config($1, $2, true)', ['request.jwt.claims', ''])
      break
    case 'user':
      await tx.query('set local role authenticated')
      await tx.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: identity.userId, role: 'authenticated' }),
      ])
      break
  }
}

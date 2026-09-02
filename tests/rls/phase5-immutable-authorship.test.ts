import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, withIdentity, withRollback } from './support/db'

/**
 * Autoria e data de criação são imutáveis.
 *
 * Regressão de um achado da validação hospedada da FASE 5: a policy decide
 * QUAIS LINHAS podem ser escritas, nunca QUAIS COLUNAS. Quem passa por
 * `clients_update` reescrevia a linha inteira — `created_at` e `created_by`
 * incluídos —, e a única coisa entre isso e a Data API era a aplicação não
 * pedir. A aplicação não é a última fechadura.
 *
 * Não é isolamento entre tenants: quem consegue já alcançava a linha. É
 * integridade de auditoria, e num sistema que existe para registrar decisões um
 * `created_by` que aceita ser reescrito vale menos que nenhum.
 */

const ADMIN = '10000000-0000-4000-8000-000000000001'
const ANA = '10000000-0000-4000-8000-000000000002' /* boop_member, Hartmann */
const HARTMANN = '20000000-0000-4000-8000-000000000001'

/** `23514` — check_violation, o errcode de `app.enforce_immutable_columns()`. */
const IMMUTABLE = '23514'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('clients — a tabela onde o achado apareceu', () => {
  it('⚠️ boop_admin NÃO reescreve `created_at`', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const erro = await tx.expectError(
        "update public.clients set created_at = '2000-01-01' where id = $1",
        [HARTMANN],
      )
      expect(erro.code).toBe(IMMUTABLE)
    }))

  it('⚠️ boop_member NÃO reescreve autoria do cliente que atende', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const erro = await tx.expectError('update public.clients set created_by = $2 where id = $1', [
        HARTMANN,
        ANA,
      ])
      expect(erro.code).toBe(IMMUTABLE)
    }))

  it('a edição legítima continua passando', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      /*
       * O par positivo. Um trigger de imutabilidade escrito larga demais
       * bloquearia o UPDATE inteiro, e o teste negativo sozinho não perceberia.
       */
      const { rowCount } = await tx.query(
        "update public.clients set name = 'Hartmann & Cia', notes = 'nota nova' where id = $1",
        [HARTMANN],
      )
      expect(rowCount).toBe(1)
    }))

  it('`updated_at` continua sendo escrito pelo trigger', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query<{ mudou: boolean }>(
        `with antes as (select updated_at from public.clients where id = $1),
              upd as (update public.clients set name = 'Novo' where id = $1 returning updated_at)
         select (select updated_at from upd) > (select updated_at from antes) as mudou`,
        [HARTMANN],
      )
      expect(rows[0]?.mudou).toBe(true)
    }))
})

describe('varredura — nenhuma tabela nova escapa da regra', () => {
  it('⚠️ toda tabela com UPDATE para `authenticated` protege as colunas de autoria', async () =>
    /*
     * Como dono, e não como `authenticated`: isto é varredura de catálogo, não
     * prova de isolamento. `authenticated` nem tem USAGE no schema `app` para
     * resolver o `::regproc` — e não deveria ter.
     */
    withRollback(db, async (tx) => {
      /*
       * Varredura, e não lista transcrita: uma lista precisaria ser lembrada
       * quando a FASE 6 criar a próxima tabela, e ninguém lembra. Esta consulta
       * falha sozinha no dia em que alguém conceder UPDATE sem o trigger.
       *
       * A varredura conta as DUAS funções: `created_at` é estrito
       * (`enforce_immutable_columns`) e a autoria é não-reatribuível
       * (`enforce_authorship_not_reassigned`) — ver o cabeçalho da migration.
       *
       * `submitted_by` fica FORA da regra de propósito: ele nasce nulo e é
       * preenchido no UPDATE que submete o onboarding (FASE 7). Autoria que se
       * define no meio da vida da linha não é autoria de criação.
       */
      const { rows } = await tx.query<{ tabela: string; coluna: string }>(`
        with atualizaveis as (
          select distinct table_name from information_schema.role_table_grants
           where table_schema = 'public'
             and grantee = 'authenticated'
             and privilege_type = 'UPDATE'
        ),
        autoria as (
          select c.relname as tabela, a.attname as coluna
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
           where n.nspname = 'public' and c.relkind = 'r'
             and a.attname in ('created_at', 'created_by', 'author_id')
        ),
        protegidas as (
          select c.relname as tabela, x.col as coluna
            from pg_trigger t
            join pg_class c on c.oid = t.tgrelid
            cross join lateral unnest(
              string_to_array(encode(t.tgargs, 'escape'), '\\000')
            ) as x(col)
           where not t.tgisinternal
             and t.tgfoid in (
               'app.enforce_immutable_columns'::regproc,
               'app.enforce_authorship_not_reassigned'::regproc
             )
        )
        select a.tabela, a.coluna
          from autoria a
          join atualizaveis u on u.table_name = a.tabela
          left join protegidas p on p.tabela = a.tabela and p.coluna = a.coluna
         where p.coluna is null
         order by a.tabela, a.coluna
      `)

      const desprotegidas = rows.map((r) => `${r.tabela}.${r.coluna}`)

      expect(
        desprotegidas,
        `sem trigger de imutabilidade de autoria: ${desprotegidas.join(', ')}`,
      ).toEqual([])
    }))

  it('a varredura enxerga as tabelas que deveria — não passa por vazio', async () =>
    withRollback(db, async (tx) => {
      /* Guarda contra a consulta acima quebrar e virar tautologia. */
      const { rows } = await tx.query<{ n: string }>(`
        select count(*) as n
          from pg_trigger t
         where not t.tgisinternal
           and t.tgfoid in (
             'app.enforce_immutable_columns'::regproc,
             'app.enforce_authorship_not_reassigned'::regproc
           )
      `)
      expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(20)
    }))
})

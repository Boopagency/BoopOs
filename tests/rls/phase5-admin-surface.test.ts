import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CLIENT_DETAIL_COLUMNS,
  CLIENT_LIST_COLUMNS,
  CLIENT_PUBLIC_COLUMNS,
} from '@/domains/clients/types'
import { asUser, connect, switchIdentity, withIdentity, type Tx } from './support/db'

/**
 * FASE 5 — a superfície administrativa contra Postgres real.
 *
 * ## O que este arquivo prova, e o que ele não prova
 *
 * As constantes de coluna são **importadas do código de produção**, não
 * transcritas: `CLIENT_PUBLIC_COLUMNS` aqui é literalmente a string que
 * `getClientPublic()` passa ao `.select()`. Então o que roda contra o banco é a
 * projeção que a aplicação envia, e não uma imitação dela.
 *
 * O que fica de fora: o PostgREST. Sem Docker nesta máquina, o plano B é um
 * Postgres nu com shim de auth — vale para migrations, policies, triggers e
 * RLS, e não vale para a Data API. A cobertura do caminho HTTP vem do staging,
 * registrada em `docs/FASE5ESTADO.md`.
 *
 * Todo caso aos pares: o que cada papel vê **e** o que ele não vê.
 */

const ADMIN = '10000000-0000-4000-8000-000000000001' /* Marina, boop_admin       */
const ANA = '10000000-0000-4000-8000-000000000002' /* boop_member, Hartmann    */
const RAFA = '10000000-0000-4000-8000-000000000003' /* boop_member, Velmont     */
const DANI = '10000000-0000-4000-8000-000000000004' /* boop_member, SEM vinculo */
const CECILIA = '10000000-0000-4000-8000-000000000005' /* client_user, Hartmann    */
const JOAO = '10000000-0000-4000-8000-000000000006' /* client_user, Velmont     */

const HARTMANN = '20000000-0000-4000-8000-000000000001'
const VELMONT = '20000000-0000-4000-8000-000000000002'

const DENIED = '42501'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

const nomes = (rows: Record<string, unknown>[]): string[] => rows.map((r) => String(r.name)).sort()

describe('a projeção da LISTA administrativa (CLIENT_LIST_COLUMNS)', () => {
  it('boop_admin vê os dois tenants', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query(`select ${CLIENT_LIST_COLUMNS} from public.clients`)
      expect(nomes(rows)).toEqual(['Hartmann', 'Velmont'])
    }))

  it('boop_member vê só o cliente do seu vínculo', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rows } = await tx.query(`select ${CLIENT_LIST_COLUMNS} from public.clients`)
      expect(nomes(rows)).toEqual(['Hartmann'])
    }))

  it('⚠️ boop_member SEM vínculo não vê cliente nenhum', async () =>
    withIdentity(db, asUser(DANI), async (tx) => {
      const { rows } = await tx.query(`select ${CLIENT_LIST_COLUMNS} from public.clients`)
      expect(rows).toHaveLength(0)
    }))

  it('⚠️ a projeção da lista NÃO traz `notes` para ninguém — nem para o admin', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query(`select ${CLIENT_LIST_COLUMNS} from public.clients limit 1`)
      /*
       * A chave não existe no objeto — não é `null`, não é string vazia. O que
       * não foi buscado não pode vazar em serialização de RSC (§49).
       */
      expect(Object.keys(rows[0] ?? {})).not.toContain('notes')
    }))
})

describe('a projeção CLIENT-FACING (CLIENT_PUBLIC_COLUMNS)', () => {
  it('⚠️ nunca traz `notes` — nem para o próprio tenant do cliente', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      const { rows } = await tx.query(
        `select ${CLIENT_PUBLIC_COLUMNS} from public.clients where id = $1`,
        [HARTMANN],
      )

      expect(rows).toHaveLength(1)
      expect(rows[0]?.name).toBe('Hartmann')
      /* O caso que fecha a dívida column-level da FASE 4. */
      expect(Object.keys(rows[0] ?? {})).not.toContain('notes')
    }))

  it('⚠️ e nem traz `notes` para o admin, que teria direito a ela', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query(
        `select ${CLIENT_PUBLIC_COLUMNS} from public.clients where id = $1`,
        [HARTMANN],
      )
      expect(Object.keys(rows[0] ?? {})).not.toContain('notes')
    }))

  it('⚠️ client_user NÃO alcança o outro tenant, nem com o id correto na mão', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      const { rows } = await tx.query(
        `select ${CLIENT_PUBLIC_COLUMNS} from public.clients where id = $1`,
        [VELMONT],
      )
      /* Zero linhas — que é o que vira 404 na aplicação, e não 403. */
      expect(rows).toHaveLength(0)
    }))

  it('⚠️ boop_member NÃO alcança o tenant do colega', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rows } = await tx.query(
        `select ${CLIENT_PUBLIC_COLUMNS} from public.clients where id = $1`,
        [VELMONT],
      )
      expect(rows).toHaveLength(0)
    }))
})

describe('a projeção do DETALHE interno (CLIENT_DETAIL_COLUMNS)', () => {
  it('traz `notes` para a Boop — é a única projeção que traz', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rows } = await tx.query(
        `select ${CLIENT_DETAIL_COLUMNS} from public.clients where id = $1`,
        [HARTMANN],
      )

      expect(Object.keys(rows[0] ?? {})).toContain('notes')
      expect(String(rows[0]?.notes)).toContain('Nota interna')
    }))

  it('⚠️ o BANCO devolveria `notes` a um client_user — quem o impede é a aplicação', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      /*
       * Este caso afirma a LIMITAÇÃO, não a proteção, e é de propósito.
       *
       * RLS é row-level: a policy concede a linha da Hartmann a Cecilia, e
       * `notes` está nela. Nenhum GRANT de coluna separa as personas —
       * `authenticated` é um papel só para as três (docs/security.md).
       *
       * O que impede o vazamento é `getClientPublic()` nunca pedir a coluna, e
       * `getClientDetailForBoop()` exigir `can('client.read_internal_notes')`
       * antes de pedi-la. Os dois casos acima provam isso.
       *
       * Se este teste um dia FALHAR, a limitação deixou de existir — e aí
       * `docs/security.md` e este arquivo precisam ser atualizados juntos.
       */
      const { rows } = await tx.query('select notes from public.clients where id = $1', [HARTMANN])

      expect(rows).toHaveLength(1)
      expect(
        rows[0]?.notes,
        'clients.notes deixou de vir na linha — atualize docs/security.md e este teste',
      ).not.toBeNull()
    }))
})

describe('escrita de cliente', () => {
  it('boop_admin cria cliente', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.clients (name, slug, created_by) values ('Teste', 'teste-fase5', $1)
         returning id`,
        [ADMIN],
      )
      expect(rows[0]?.id).toBeTruthy()
    }))

  it('⚠️ boop_member NÃO cria cliente', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const erro = await tx.expectError(
        `insert into public.clients (name, slug) values ('Teste', 'teste-fase5')`,
      )
      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ client_user NÃO cria cliente', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      const erro = await tx.expectError(
        `insert into public.clients (name, slug) values ('Teste', 'teste-fase5')`,
      )
      expect(erro.code).toBe(DENIED)
    }))

  it('boop_member edita o cliente do seu vínculo', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rowCount } = await tx.query(
        "update public.clients set name = 'Hartmann & Cia' where id = $1",
        [HARTMANN],
      )
      expect(rowCount).toBe(1)
    }))

  it('⚠️ boop_member NÃO edita o tenant do colega — zero linhas, sem erro', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rowCount } = await tx.query(
        "update public.clients set name = 'Sequestrado' where id = $1",
        [VELMONT],
      )
      /*
       * A RLS filtra o UPDATE em vez de recusá-lo: zero linhas, sem exceção. É
       * por isso que `updateClient` trata `!data` como 404 — sem esse ramo, a
       * tela diria "salvo" para uma escrita que não aconteceu.
       */
      expect(rowCount).toBe(0)
    }))

  it('⚠️ client_user NÃO edita o próprio cliente — filtrado, não recusado', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      /*
       * Zero linhas, e NÃO erro de privilégio: o GRANT de UPDATE em `clients`
       * é do papel `authenticated` inteiro, então quem separa as personas é a
       * policy — `clients_update` exige `is_boop()`, que é falso aqui, e o
       * Postgres filtra em vez de recusar.
       *
       * A distinção importa para a aplicação: uma escrita filtrada volta
       * silenciosa, com `error = null`. É por isso que todo workflow de UPDATE
       * trata "zero linhas" como 404 — sem esse ramo, a tela diria "salvo".
       */
      const { rowCount } = await tx.query("update public.clients set name = 'Meu' where id = $1", [
        HARTMANN,
      ])
      expect(rowCount).toBe(0)
    }))

  it('⚠️ ninguém apaga cliente: não há policy nem GRANT de DELETE', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const erro = await tx.expectError('delete from public.clients where id = $1', [HARTMANN])
      expect(erro.code).toBe(DENIED)
    }))
})

describe('vínculos — a tabela que concede escopo', () => {
  it('boop_admin concede vínculo', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.client_memberships (client_id, user_id, created_by)
         values ($1, $2, $3) returning id`,
        [VELMONT, CECILIA, ADMIN],
      )
      expect(rows[0]?.id).toBeTruthy()
    }))

  it('⚠️ AUTO-CONCESSÃO É IMPOSSÍVEL: boop_member não se dá acesso a outro tenant', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const erro = await tx.expectError(
        `insert into public.client_memberships (client_id, user_id) values ($1, $2)`,
        [VELMONT, ANA],
      )
      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ AUTO-CONCESSÃO É IMPOSSÍVEL: client_user não se dá acesso a outro tenant', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      const erro = await tx.expectError(
        `insert into public.client_memberships (client_id, user_id) values ($1, $2)`,
        [VELMONT, CECILIA],
      )
      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ boop_member NÃO revoga vínculo — filtrado, não recusado', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      /*
       * Mesma mecânica do UPDATE acima: `client_memberships_delete` exige
       * `is_boop_admin()`, e o DELETE volta com zero linhas em vez de erro.
       *
       * Ana consegue LER os três vínculos da Hartmann (ela atende a conta), o
       * que a faria passar por uma verificação ingênua de "o recurso existe?".
       * Por isso `revokeClientAccess` confere quantas linhas o DELETE removeu,
       * e não apenas se a leitura anterior encontrou algo.
       */
      const { rowCount } = await tx.query(
        'delete from public.client_memberships where client_id = $1',
        [HARTMANN],
      )
      expect(rowCount).toBe(0)

      const restantes = await tx.query('select id from public.client_memberships')
      expect(restantes.rowCount).toBe(3)
    }))

  it('⚠️ convidar duas vezes gera UM vínculo, não dois', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      await tx.query(
        `insert into public.client_memberships (client_id, user_id, created_by)
         values ($1, $2, $3)`,
        [VELMONT, CECILIA, ADMIN],
      )

      const erro = await tx.expectError(
        `insert into public.client_memberships (client_id, user_id, created_by)
         values ($1, $2, $3)`,
        [VELMONT, CECILIA, ADMIN],
      )

      /* `23505` — a unique do banco é quem garante a idempotência do convite. */
      expect(erro.code).toBe('23505')
    }))

  it('⚠️ client_user vê o PRÓPRIO vínculo, não a lista de quem atende a conta', async () =>
    withIdentity(db, asUser(CECILIA), async (tx) => {
      const { rows } = await tx.query<{ user_id: string }>(
        'select user_id from public.client_memberships',
      )

      expect(rows).toHaveLength(1)
      expect(rows[0]?.user_id).toBe(CECILIA)
    }))

  it('boop_member vê o time inteiro do cliente que atende', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rows } = await tx.query('select user_id from public.client_memberships')
      /* Hartmann tem três vínculos no seed: Ana, Cecilia e Marta. */
      expect(rows).toHaveLength(3)
    }))
})

describe('pessoas — a projeção de `/admin/usuarios`', () => {
  const PROFILE_COLUMNS = 'id, full_name, email, role, status'

  it('boop_admin enxerga todo mundo', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      const { rows } = await tx.query(`select ${PROFILE_COLUMNS} from public.profiles`)
      expect(rows.length).toBe(7)
    }))

  it('boop_member enxerga quem divide um cliente com ele', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const { rows } = await tx.query<{ email: string }>(
        `select ${PROFILE_COLUMNS} from public.profiles`,
      )
      const emails = rows.map((r) => r.email).sort()

      /* Ana + os dois client_user da Hartmann. Ninguém da Velmont. */
      expect(emails).toEqual([
        'ana@boop.example.com',
        'cecilia@hartmann.example.com',
        'marta@hartmann.example.com',
      ])
      expect(emails).not.toContain('joao@velmont.example.com')
    }))

  it('⚠️ boop_member sem vínculo enxerga só a própria linha', async () =>
    withIdentity(db, asUser(DANI), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select ${PROFILE_COLUMNS} from public.profiles`,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]?.id).toBe(DANI)
    }))

  it('⚠️ client_user enxerga só a própria linha — não o time da Boop', async () =>
    withIdentity(db, asUser(JOAO), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select ${PROFILE_COLUMNS} from public.profiles`,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]?.id).toBe(JOAO)
    }))
})

describe('activity log — a auditoria da Boop', () => {
  async function registrarEvento(tx: Tx, clientId: string | null): Promise<void> {
    await tx.query(
      `select public.record_activity('client.updated', 'client', null, $1, null, '{}'::jsonb, 'internal')`,
      [clientId],
    )
  }

  it('boop_admin lê o log', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      await registrarEvento(tx, HARTMANN)
      const { rows } = await tx.query('select id from public.activity_log')
      expect(rows.length).toBeGreaterThan(0)
    }))

  it('boop_member lê o log do cliente que atende', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      await registrarEvento(tx, HARTMANN)
      const { rows } = await tx.query('select client_id from public.activity_log')
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.client_id === HARTMANN)).toBe(true)
    }))

  it('⚠️ boop_member lê SÓ o log do seu tenant, nunca o do colega', async () =>
    withIdentity(db, asUser(RAFA), async (tx) => {
      /*
       * Rafa atende a Velmont. O seed tem eventos dos dois tenants, então a
       * asserção não é "ele não vê nada" — é "tudo o que ele vê é dele".
       * O teste que espera zero passaria por acidente num banco vazio.
       */
      const { rows } = await tx.query<{ client_id: string }>(
        'select client_id from public.activity_log',
      )

      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.client_id === VELMONT)).toBe(true)
      expect(rows.some((r) => r.client_id === HARTMANN)).toBe(false)
    }))

  it('⚠️ client_user NÃO lê o log — D-05, a matriz não lhe dá activity.read', async () =>
    withIdentity(db, asUser(ADMIN), async (tx) => {
      await registrarEvento(tx, HARTMANN)

      await switchIdentity(tx, asUser(CECILIA))
      const { rows } = await tx.query('select id from public.activity_log')
      expect(rows).toHaveLength(0)
    }))

  it('⚠️ ninguém atribui evento a um tenant que não alcança', async () =>
    withIdentity(db, asUser(ANA), async (tx) => {
      const erro = await tx.expectError(
        `select public.record_activity('client.updated', 'client', null, $1, null, '{}'::jsonb, 'internal')`,
        [VELMONT],
      )
      expect(erro.code).toBe(DENIED)
    }))
})

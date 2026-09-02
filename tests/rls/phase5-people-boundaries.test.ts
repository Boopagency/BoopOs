import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ANONYMOUS, asUser, connect, switchIdentity, withRollback, type Tx } from './support/db'

/**
 * FASE 5 — as duas fronteiras de administração de pessoas.
 *
 * `assign_invited_profile_role()` e `disable_profile()` são o gatilho de revisão
 * que a ADR-0022 deixou marcado: "uma operação de administração de pessoas
 * (FASE 5) que exija escrever `profiles` fora da promoção".
 *
 * São `security definer`, então executam com o privilégio do dono e ignoram a
 * RLS por definição. É exatamente por isso que cada uma precisa de teste
 * adversarial: a proteção não está numa policy que alguém possa conferir no
 * catálogo do Postgres, está no CORPO da função. Um `if` que sumisse num
 * refactor não quebraria nenhum outro teste da suíte.
 *
 * Todo caso é escrito aos pares: o que a fronteira faz **e** o que ela recusa.
 */

const ADMIN = '10000000-0000-4000-8000-000000000001' /* Marina, boop_admin    */
const ANA = '10000000-0000-4000-8000-000000000002' /* boop_member, Hartmann */
const CECILIA = '10000000-0000-4000-8000-000000000005' /* client_user, Hartmann */
const HARTMANN = '20000000-0000-4000-8000-000000000001'

/** A pessoa recém-convidada que cada caso cria — e o rollback desfaz. */
const CONVIDADA = '10000000-0000-4000-8000-0000000000f1'

/** `42501` — insufficient_privilege. É o errcode que as duas fronteiras usam. */
const DENIED = '42501'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

/**
 * Cria uma pessoa `invited`, como o dono do banco.
 *
 * Dono, e não `service_role`: `auth.users` não é escrevível nem pelo papel de
 * serviço — aqui nem no Supabase hospedado. O papel privilegiado monta o
 * cenário; a operação sob teste roda sempre como `authenticated`
 * (.claude/rules/testing.md).
 *
 * O trigger `app.handle_new_auth_user()` cria o espelho em `profiles` com o
 * default `client_user` / `invited`, que é justamente o estado de partida do
 * convite real.
 */
async function criarConvidada(tx: Tx): Promise<void> {
  await tx.query(
    `insert into auth.users (
       instance_id, id, aud, role, email,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at
     ) values (
       '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
       'convidada@exemplo.example.com', '{}'::jsonb, '{}'::jsonb, now(), now()
     )`,
    [CONVIDADA],
  )
}

async function papelDe(tx: Tx, userId: string): Promise<string> {
  const { rows } = await tx.query<{ role: string }>(
    'select role from public.profiles where id = $1',
    [userId],
  )
  return rows[0]?.role ?? 'ausente'
}

async function statusDe(tx: Tx, userId: string): Promise<string> {
  const { rows } = await tx.query<{ status: string }>(
    'select status from public.profiles where id = $1',
    [userId],
  )
  return rows[0]?.status ?? 'ausente'
}

describe('assign_invited_profile_role', () => {
  it('boop_admin define o papel de quem esta `invited`', async () =>
    withRollback(db, async (tx) => {
      await criarConvidada(tx)
      await switchIdentity(tx, asUser(ADMIN))

      const { rows } = await tx.query<{ r: string }>(
        'select public.assign_invited_profile_role($1, $2) as r',
        [CONVIDADA, 'boop_member'],
      )

      expect(rows[0]?.r).toBe('assigned')

      await switchIdentity(tx, asUser(ADMIN))
      expect(await papelDe(tx, CONVIDADA)).toBe('boop_member')
    }))

  it('e idempotente: reatribuir o mesmo papel nao quebra', async () =>
    withRollback(db, async (tx) => {
      await criarConvidada(tx)
      await switchIdentity(tx, asUser(ADMIN))

      await tx.query('select public.assign_invited_profile_role($1, $2)', [
        CONVIDADA,
        'boop_member',
      ])
      const { rows } = await tx.query<{ r: string }>(
        'select public.assign_invited_profile_role($1, $2) as r',
        [CONVIDADA, 'boop_member'],
      )

      expect(rows[0]?.r).toBe('assigned')
      expect(await papelDe(tx, CONVIDADA)).toBe('boop_member')
    }))

  it('⚠️ RECUSA boop_admin como valor — a matriz nao tem essa linha', async () =>
    withRollback(db, async (tx) => {
      await criarConvidada(tx)
      await switchIdentity(tx, asUser(ADMIN))

      const erro = await tx.expectError('select public.assign_invited_profile_role($1, $2)', [
        CONVIDADA,
        'boop_admin',
      ])

      expect(erro.code).toBe(DENIED)

      await switchIdentity(tx, asUser(ADMIN))
      /* Continua com o default do trigger: a fabrica de admins nao existe. */
      expect(await papelDe(tx, CONVIDADA)).toBe('client_user')
    }))

  it('⚠️ boop_member NAO define papel de ninguem', async () =>
    withRollback(db, async (tx) => {
      await criarConvidada(tx)
      await switchIdentity(tx, asUser(ANA))

      const erro = await tx.expectError('select public.assign_invited_profile_role($1, $2)', [
        CONVIDADA,
        'boop_member',
      ])

      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ client_user NAO define papel de ninguem', async () =>
    withRollback(db, async (tx) => {
      await criarConvidada(tx)
      await switchIdentity(tx, asUser(CECILIA))

      const erro = await tx.expectError('select public.assign_invited_profile_role($1, $2)', [
        CONVIDADA,
        'client_user',
      ])

      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ o alvo nao pode ser quem chama', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      const erro = await tx.expectError('select public.assign_invited_profile_role($1, $2)', [
        ADMIN,
        'boop_member',
      ])

      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ NAO alcanca perfil ja `active`: trocar papel de quem trabalha nao esta na matriz', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      const { rows } = await tx.query<{ r: string }>(
        'select public.assign_invited_profile_role($1, $2) as r',
        [CECILIA, 'boop_member'],
      )

      expect(rows[0]?.r).toBe('not_invited')
      expect(await papelDe(tx, CECILIA)).toBe('client_user')
    }))

  it('⚠️ anon nao tem EXECUTE', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, ANONYMOUS)

      const erro = await tx.expectError('select public.assign_invited_profile_role($1, $2)', [
        CONVIDADA,
        'client_user',
      ])

      expect(erro.code).toBe(DENIED)
    }))
})

describe('disable_profile', () => {
  it('boop_admin desliga uma pessoa ativa', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      const { rows } = await tx.query<{ r: string }>('select public.disable_profile($1) as r', [
        CECILIA,
      ])

      expect(rows[0]?.r).toBe('disabled')
      expect(await statusDe(tx, CECILIA)).toBe('disabled')
    }))

  it('e idempotente: desligar de novo devolve `already_disabled`', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      await tx.query('select public.disable_profile($1)', [CECILIA])
      const { rows } = await tx.query<{ r: string }>('select public.disable_profile($1) as r', [
        CECILIA,
      ])

      expect(rows[0]?.r).toBe('already_disabled')
    }))

  it('pessoa inexistente devolve `not_found`, sem lancar', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      const { rows } = await tx.query<{ r: string }>('select public.disable_profile($1) as r', [
        '10000000-0000-4000-8000-0000000000ff',
      ])

      expect(rows[0]?.r).toBe('not_found')
    }))

  it('⚠️ desligar tira o acesso na hora, pela RLS', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      /* Antes: Cecilia alcanca a Hartmann. */
      await switchIdentity(tx, asUser(CECILIA))
      const antes = await tx.query('select id from public.clients where id = $1', [HARTMANN])
      expect(antes.rowCount).toBe(1)

      await switchIdentity(tx, asUser(ADMIN))
      await tx.query('select public.disable_profile($1)', [CECILIA])

      /*
       * Depois: nada. A prova vem do papel comum lendo a tabela, e nao de
       * `app.has_client_access()` — `authenticated` nao tem USAGE no schema
       * `app`, de propósito: aquelas funcoes existem para ser avaliadas DENTRO
       * das policies, como definer, e nao para ser chamadas por quem consulta.
       *
       * A leitura vazia e a prova mais forte, porque e o caminho real: o mesmo
       * que o PostgREST percorre no request seguinte, sem esperar o JWT expirar.
       */
      await switchIdentity(tx, asUser(CECILIA))
      const depois = await tx.query('select id from public.clients')
      expect(depois.rowCount).toBe(0)
    }))

  it('⚠️ boop_member NAO desliga ninguem', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ANA))

      const erro = await tx.expectError('select public.disable_profile($1)', [CECILIA])
      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ client_user NAO desliga ninguem', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(CECILIA))

      const erro = await tx.expectError('select public.disable_profile($1)', [ANA])
      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ ninguem se desliga: sem caminho de volta, seria trancar a porta por dentro', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      const erro = await tx.expectError('select public.disable_profile($1)', [ADMIN])
      expect(erro.code).toBe(DENIED)
      expect(await statusDe(tx, ADMIN)).toBe('active')
    }))

  it('⚠️ anon nao tem EXECUTE', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, ANONYMOUS)

      const erro = await tx.expectError('select public.disable_profile($1)', [CECILIA])
      expect(erro.code).toBe(DENIED)
    }))
})

describe('profiles continua sem UPDATE pela Data API', () => {
  it('⚠️ as fronteiras NAO abriram a porta generica: escalada de papel segue impossivel', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(CECILIA))

      /*
       * O ataque que a ADR-0022 nomeia:
       *   update profiles set role = 'boop_admin' where id = auth.uid()
       * Sem policy e sem GRANT de UPDATE, ele morre no privilegio.
       */
      const erro = await tx.expectError(
        "update public.profiles set role = 'boop_admin' where id = $1",
        [CECILIA],
      )

      expect(erro.code).toBe(DENIED)
    }))

  it('⚠️ nem boop_admin escreve `profiles` direto — so pelas fronteiras', async () =>
    withRollback(db, async (tx) => {
      await switchIdentity(tx, asUser(ADMIN))

      const erro = await tx.expectError(
        "update public.profiles set status = 'disabled' where id = $1",
        [CECILIA],
      )

      expect(erro.code).toBe(DENIED)
    }))
})

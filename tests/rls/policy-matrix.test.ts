/**
 * Varredura: a matriz de policies e grants, declarada aqui e conferida contra
 * o catalogo do Postgres.
 *
 * Os outros arquivos provam que as regras FUNCIONAM. Este prova que elas
 * EXISTEM, todas, e que ninguem acrescentou tabela, grant ou policy sem passar
 * por uma decisao. E o teste que quebra quando a FASE 5 criar uma tabela e
 * esquecer a RLS — que e exatamente quando ele precisa quebrar.
 *
 * A tabela abaixo e a resposta a "role x resource x operation" sem ler SQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { ANONYMOUS, asUser, connect, withIdentity } from './support/db'
import { BOOP_ADMIN, TABELAS } from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

/** S=select I=insert U=update D=delete. Ausencia e decisao, nao esquecimento. */
type Operacoes = string

/**
 * A matriz da FASE 4.
 *
 * `policies` e `grants` sao iguais em toda linha, e isso NAO e redundancia: e
 * a invariante das duas fechaduras. Um GRANT sem policy deixa a porta so com a
 * RLS segurando; uma policy sem GRANT deixa a tabela morta em silencio, com o
 * sintoma indistinguivel de "a RLS negou". O teste no fim do arquivo afirma a
 * igualdade para todas as dezenove, entao a divergencia nao passa.
 */
const MATRIZ: Record<string, { policies: Operacoes; grants: Operacoes; porque: string }> = {
  /* Identidade. Escrita so pelo espelho de auth.users e pela funcao de promocao. */
  profiles: {
    policies: 'S',
    grants: 'S',
    porque: 'role e status moram aqui: UPDATE seria escalada',
  },

  clients: { policies: 'SIU', grants: 'SIU', porque: 'archive e status, nao DELETE' },
  client_memberships: {
    policies: 'SID',
    grants: 'SID',
    porque: 'vinculo se concede e revoga; nao se edita',
  },
  projects: { policies: 'SIU', grants: 'SIU', porque: 'archive e status' },
  project_stages: {
    policies: 'SIUD',
    grants: 'SIUD',
    porque: 'a jornada e estrutural: o admin remonta',
  },

  onboarding_templates: {
    policies: 'SIUD',
    grants: 'SIUD',
    porque: 'catalogo: leitura derivada, escrita so admin',
  },
  onboarding_sections: { policies: 'SIUD', grants: 'SIUD', porque: 'idem catalogo' },
  onboarding_questions: { policies: 'SIUD', grants: 'SIUD', porque: 'idem catalogo' },
  /*
   * FASE 7: caiu de `SIU` para `S`.
   *
   * Escrever aqui deixou de ser possivel pela API. O ciclo de vida inteiro —
   * abrir, enviar, reabrir — passa por `start_onboarding()`,
   * `submit_onboarding()` e `reopen_onboarding()`, e por mais nada. Com o
   * UPDATE aberto, um `client_user` movia `draft -> submitted` pelo PostgREST,
   * sem avancar a jornada e sem gravar activity: uma submissao enviada que o
   * sistema nao sabia que existia.
   *
   * E a mesma decisao de `strategy_approvals` e `content_approvals`, tomada na
   * FASE 4 pela mesma razao.
   */
  onboarding_submissions: {
    policies: 'S',
    grants: 'S',
    porque: 'ciclo de vida so por RPC; escrita direta nao existe',
  },
  onboarding_answers: {
    policies: 'SIU',
    grants: 'SIU',
    porque: 'apagar resposta e reescrever o que foi dito',
  },

  strategies: { policies: 'SIU', grants: 'SIU', porque: 'container da estrategia do projeto' },
  strategy_versions: { policies: 'SIU', grants: 'SIU', porque: 'versao nao se apaga: supersede' },
  strategy_approvals: {
    policies: 'S',
    grants: 'S',
    porque: 'APROVACAO NAO SE ESCREVE PELA API — RPC na FASE 11',
  },

  content_items: { policies: 'SIUD', grants: 'SIUD', porque: 'forma padrao de docs/security.md' },
  content_versions: { policies: 'SIUD', grants: 'SIUD', porque: 'idem' },
  content_comments: { policies: 'SIUD', grants: 'SIUD', porque: 'idem' },
  content_approvals: {
    policies: 'S',
    grants: 'S',
    porque: 'APROVACAO NAO SE ESCREVE PELA API — RPC na FASE 11',
  },

  activity_log: {
    policies: 'S',
    grants: 'S',
    porque: 'append-only; escrita por record_activity()',
  },
  notifications: {
    policies: 'S',
    grants: 'S',
    porque: 'operacao da Boop; escrita pelo servidor na FASE 16',
  },
}

const LETRA: Record<string, string> = { r: 'S', a: 'I', w: 'U', d: 'D' }

function ordenar(ops: string) {
  return [...new Set(ops)].sort().join('')
}

describe('a matriz declarada bate com o catalogo', () => {
  it('a matriz cobre exatamente as 19 tabelas do Marco 1', () => {
    expect(Object.keys(MATRIZ).sort()).toEqual([...TABELAS].sort())
  })

  it('nenhuma tabela de public ficou fora da matriz', async () => {
    const { rows } = await db.query<{ nome: string }>(`
      select c.relname as nome
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
    `)
    /* Tabela nova aparece aqui antes de aparecer em qualquer tela. */
    expect(rows.map((r) => r.nome).sort()).toEqual(Object.keys(MATRIZ).sort())
  })

  it('toda tabela tem RLS habilitada', async () => {
    const { rows } = await db.query<{ nome: string; rls: boolean }>(`
      select c.relname as nome, c.relrowsecurity as rls
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
    `)
    const semRls = rows.filter((r) => !r.rls).map((r) => r.nome)
    expect(semRls, `tabelas sem RLS: ${semRls.join(', ')}`).toEqual([])
  })

  it('as policies de cada tabela sao exatamente as declaradas', async () => {
    const { rows } = await db.query<{ nome: string; cmds: string[] }>(`
      select c.relname as nome, array_agg(distinct p.polcmd::text) as cmds
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_policy p on p.polrelid = c.oid
       where n.nspname = 'public'
       group by c.relname
    `)

    const encontrado = new Map(
      rows.map((r) => [r.nome, ordenar(r.cmds.map((c) => LETRA[c] ?? c).join(''))]),
    )

    for (const [tabela, { policies, porque }] of Object.entries(MATRIZ)) {
      expect(encontrado.get(tabela) ?? '', `${tabela} (${porque})`).toBe(ordenar(policies))
    }
  })

  it('os grants de authenticated sao exatamente os declarados', async () => {
    const { rows } = await db.query<{ nome: string; privs: string[] }>(`
      select table_name as nome, array_agg(distinct privilege_type::text) as privs
        from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated'
       group by table_name
    `)

    const inicial: Record<string, string> = { SELECT: 'S', INSERT: 'I', UPDATE: 'U', DELETE: 'D' }
    const encontrado = new Map(
      rows.map((r) => [r.nome, ordenar(r.privs.map((p) => inicial[p] ?? '?').join(''))]),
    )

    for (const [tabela, { grants, porque }] of Object.entries(MATRIZ)) {
      expect(encontrado.get(tabela) ?? '', `${tabela} (${porque})`).toBe(ordenar(grants))
    }
  })

  it('DUAS FECHADURAS: nenhum grant sem policy, nenhuma policy sem grant', () => {
    /*
     * A invariante que resume a fase. Se um dia alguem conceder DELETE "so
     * para desbloquear" sem escrever a policy, ou escrever a policy e esquecer
     * o GRANT, este teste aponta a tabela pelo nome.
     */
    for (const [tabela, { policies, grants }] of Object.entries(MATRIZ)) {
      expect(ordenar(policies), `${tabela}: policy e grant divergem`).toBe(ordenar(grants))
    }
  })
})

describe('anon continua sem nada', () => {
  it('zero privilegios em toda tabela de public', async () => {
    const { rows } = await db.query<{ nome: string; priv: string }>(`
      select table_name as nome, privilege_type as priv
        from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'anon'
    `)
    expect(
      rows.map((r) => `${r.nome}.${r.priv}`),
      'anon recebeu privilegio em public',
    ).toEqual([])
  })

  it('zero privilegios em sequences', async () => {
    const { rows } = await db.query<{ n: string }>(`
      select count(*) as n
        from information_schema.role_usage_grants
       where object_schema = 'public' and grantee in ('anon', 'authenticated')
    `)
    expect(Number(rows[0]?.n)).toBe(0)
  })
})

describe('forma das policies', () => {
  it('nenhuma policy e permissiva por atalho (`using (true)`)', async () => {
    /*
     * `using (true)` e o jeito mais rapido de fazer um teste passar e o jeito
     * mais rapido de abrir a tabela inteira. Nao existe uma so aqui, e nao
     * pode passar a existir sem alguem apagar este teste de proposito.
     */
    const { rows } = await db.query<{ tabela: string; policy: string; qual: string | null }>(`
      select c.relname as tabela,
             p.polname as policy,
             pg_get_expr(p.polqual, p.polrelid) as qual
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
    `)

    const abertas = rows.filter((r) => r.qual !== null && /^\s*true\s*$/i.test(r.qual))
    expect(
      abertas.map((r) => `${r.tabela}.${r.policy}`),
      'policy permissiva encontrada',
    ).toEqual([])
  })

  it('toda policy de UPDATE tem USING e WITH CHECK', async () => {
    /*
     * Sem `WITH CHECK`, o `USING` autoriza a linha ANTES da alteracao e nada
     * confere a linha DEPOIS — que e literalmente como se troca o `client_id`
     * de uma linha e se migra dado entre tenants.
     */
    const { rows } = await db.query<{ tabela: string; policy: string; falta: string }>(`
      select c.relname as tabela, p.polname as policy,
             case when p.polqual is null then 'USING' else 'WITH CHECK' end as falta
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and p.polcmd = 'w'
         and (p.polqual is null or p.polwithcheck is null)
    `)
    expect(
      rows.map((r) => `${r.tabela}.${r.policy} sem ${r.falta}`),
      'policy de UPDATE incompleta',
    ).toEqual([])
  })

  it('toda policy vale para authenticated, nunca para public', async () => {
    /* Uma policy `to public` alcanca tambem `anon`. Aqui o alvo e sempre
     * explicito, e o teste guarda isso. */
    const { rows } = await db.query<{ tabela: string; policy: string; papeis: string[] }>(`
      select c.relname as tabela, p.polname as policy,
             array(select rolname::text from pg_roles where oid = any(p.polroles)) as papeis
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
    `)
    for (const { tabela, policy, papeis } of rows) {
      expect(papeis, `${tabela}.${policy} nao mira authenticated`).toEqual(['authenticated'])
    }
  })

  it('toda policy passa por uma funcao de app — nenhuma decide sozinha', async () => {
    /*
     * O predicado escrito a mao dentro da policy e como nasce a duplicacao que
     * diverge: dezenove tabelas com a mesma regra copiada, e uma delas
     * desatualizada. Toda decisao sai de `app.*` (ADR-0004).
     */
    const { rows } = await db.query<{ tabela: string; policy: string; expr: string }>(`
      select c.relname as tabela, p.polname as policy,
             coalesce(pg_get_expr(p.polqual, p.polrelid), '') ||
             coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as expr
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
    `)
    for (const { tabela, policy, expr } of rows) {
      expect(/\bapp\./.test(expr), `${tabela}.${policy} decide sem funcao de app`).toBe(true)
    }
  })
})

describe('o schema app continua fechado', () => {
  it('anon e authenticated nao tem usage', async () => {
    const { rows } = await db.query<{ papel: string }>(`
      select r.rolname as papel
        from pg_roles r
       where r.rolname in ('anon', 'authenticated')
         and has_schema_privilege(r.rolname, 'app', 'usage')
    `)
    expect(
      rows.map((r) => r.papel),
      'papel do browser alcanca o schema app',
    ).toEqual([])
  })

  it('nenhuma funcao de app aparece na API', async () =>
    withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const erro = await tx.expectError('select app.is_boop_admin()')
      expect(erro.code).toBe('42501')
    }))

  it('as fronteiras privilegiadas de public sao executaveis so por authenticated', async () => {
    const { rows } = await db.query<{ nome: string; anon: boolean; auth: boolean }>(`
      select p.proname as nome,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as auth
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('promote_invited_profile', 'record_activity')
    `)
    expect(rows).toHaveLength(2)
    for (const { nome, anon, auth } of rows) {
      expect(anon, `public.${nome} executavel por anon`).toBe(false)
      expect(auth, `public.${nome} nao executavel por authenticated`).toBe(true)
    }
  })

  it('as duas fronteiras sao security definer com search_path fechado', async () => {
    const { rows } = await db.query<{ nome: string; definer: boolean; config: string[] | null }>(`
      select p.proname as nome, p.prosecdef as definer, p.proconfig as config
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('promote_invited_profile', 'record_activity')
    `)
    for (const { nome, definer, config } of rows) {
      expect(definer, `public.${nome} nao e security definer`).toBe(true)
      expect(
        (config ?? []).some((c) => c.startsWith('search_path=')),
        `public.${nome} sem search_path fixado`,
      ).toBe(true)
    }
  })
})

describe('anonimo nao chega nem na policy', () => {
  it('o erro e de privilegio, nao de linha vazia', async () =>
    withIdentity(db, ANONYMOUS, async (tx) => {
      /* A diferenca importa: 42501 significa que `anon` nem foi consultado
       * pela RLS. Se um dia virar "zero linhas", o GRANT voltou. */
      const erro = await tx.expectError('select * from public.profiles')
      expect(erro.code).toBe('42501')
    }))
})

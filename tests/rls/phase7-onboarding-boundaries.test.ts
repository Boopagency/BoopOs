/**
 * FASE 7 — as três fronteiras do onboarding, adversarialmente.
 *
 * `start_onboarding`, `submit_onboarding` e `reopen_onboarding` são
 * `security definer`: dentro delas a RLS NÃO é aplicada, e toda a autorização
 * está em `if`s no corpo. Um `if` que sumisse num refactor não quebraria nenhum
 * outro teste — não há policy no catálogo do Postgres para uma varredura
 * conferir. Então cada recusa escrita no corpo tem um caso aqui, e o caso falha
 * se a linha sair.
 *
 * Mesma razão de `phase5-people-boundaries` e `phase6-project-boundaries`.
 *
 * O bloco mais importante é o primeiro: **o ciclo de vida não tem porta dos
 * fundos**. Antes desta fase, um `client_user` movia `draft → submitted` com um
 * UPDATE pelo PostgREST — sem avançar a jornada e sem gravar activity. O teste
 * que prova o fechamento roda como `authenticated`, que é o papel do caminho
 * real, e não como `service_role`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, SERVICE_ROLE, switchIdentity, withIdentity, type Tx } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CLIENTE_A_DESABILITADO,
  CLIENTE_B,
  HARTMANN,
  MEMBRO_A,
  MEMBRO_B,
  MEMBRO_SEM_VINCULO,
  PROJETO_HARTMANN,
  PROJETO_VELMONT,
  SUBMISSAO_A,
  VELMONT,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

const SUBMISSAO_B = '43000000-0000-4000-8000-000000000002'
const TEMPLATE_SOCIAL = '40000000-0000-4000-8000-000000000001'

/** As quatro obrigatórias do template social. */
const OBRIGATORIAS: [string, string][] = [
  ['42000000-0000-4000-8000-000000000001', '"Porque a marca precisa existir."'],
  ['42000000-0000-4000-8000-000000000003', '"Revenda"'],
  ['42000000-0000-4000-8000-000000000004', '"Vender pelo site."'],
  ['42000000-0000-4000-8000-000000000005', '"Uma cliente de 38 anos."'],
]

async function responderObrigatorias(tx: Tx, submissionId: string) {
  for (const [questionId, valor] of OBRIGATORIAS) {
    await tx.query(
      `insert into public.onboarding_answers (submission_id, question_id, value)
       values ($1, $2, $3::jsonb)
       on conflict (submission_id, question_id) do update set value = excluded.value`,
      [submissionId, questionId, valor],
    )
  }
}

/**
 * Põe a jornada de um projeto com `onboarding` corrente.
 *
 * Assume `service_role` para montar o cenário — preparar estado é exatamente o
 * que esse papel serve para fazer aqui, e nunca o que prova isolamento.
 */
async function correnteEmOnboarding(tx: Tx, projectId: string) {
  await switchIdentity(tx, SERVICE_ROLE)

  /*
   * O estado que um avanço real deixaria: o que vem ANTES de `onboarding` está
   * concluído, `onboarding` é a corrente, o resto espera. Marcar tudo como
   * `pending` seria montar um projeto que nunca existiu — e faria o teste do
   * `reopen` acusar reescrita de histórico que na verdade nunca houve.
   */
  await tx.query(
    `update public.project_stages
        set state = 'pending', completed_at = null
      where project_id = $1`,
    [projectId],
  )
  await tx.query(
    `update public.project_stages
        set state = 'done', completed_at = now()
      where project_id = $1
        and position < (select position from public.project_stages
                         where project_id = $1 and stage_key = 'onboarding')`,
    [projectId],
  )
  await tx.query(
    `update public.project_stages set state = 'current', started_at = now()
      where project_id = $1 and stage_key = 'onboarding'`,
    [projectId],
  )
}

/**
 * Um projeto social novo, com jornada de três etapas, parado em `kickoff`.
 *
 * Criado como `boop_admin`, e não como `service_role`:
 * `create_project_with_journey` deriva o autor de `auth.uid()` e recusa uma
 * chamada sem sessão — o que é a própria regra da ADR-0022 sendo aplicada.
 */
async function projetoSocial(tx: Tx, clientId: string, nome: string): Promise<string> {
  await switchIdentity(tx, asUser(BOOP_ADMIN))

  const { rows } = await tx.query<{ id: string }>(
    `select public.create_project_with_journey($1, $2, 'social', 'social.v1', $3::jsonb, null) as id`,
    [
      clientId,
      nome,
      JSON.stringify([
        { key: 'kickoff', label: 'Início do projeto' },
        { key: 'onboarding', label: 'Onboarding' },
        { key: 'immersion', label: 'Imersão' },
      ]),
    ],
  )
  return rows[0]!.id
}

/* ═══ 1. O ciclo de vida não tem porta dos fundos ══════════════════════════ */

describe('⚠️ BYPASS: escrita direta em onboarding_submissions', () => {
  const COLUNAS: [string, string][] = [
    ['status', `status = 'submitted'`],
    ['submitted_at', `submitted_at = now()`],
    ['submitted_by', `submitted_by = '${CLIENTE_A}'`],
    ['template_id', `template_id = '${TEMPLATE_SOCIAL}'`],
    ['project_id', `project_id = '${PROJETO_VELMONT}'`],
    ['client_id', `client_id = '${VELMONT}'`],
  ]

  for (const [coluna, set] of COLUNAS) {
    it(`client_user NÃO altera \`${coluna}\` pela tabela`, async () =>
      withIdentity(db, asUser(CLIENTE_A), async (tx) => {
        await expect(
          tx.query(`update public.onboarding_submissions set ${set} where id = $1`, [SUBMISSAO_A]),
          `CLIENTE ALTEROU ${coluna} DIRETO NA TABELA`,
        ).rejects.toThrow(/permission denied/)
      }))
  }

  it('⚠️ o caminho que existia: `draft -> submitted` por UPDATE está fechado', async () =>
    withIdentity(db, asUser(CLIENTE_B), async (tx) => {
      /*
       * A submissão da Velmont ESTÁ em `draft` e É do cliente B: a policy
       * antiga concederia a linha. O que recusa agora é a falta do privilégio,
       * e é por isso que a mensagem é "permission denied" e não "0 linhas".
       */
      await expect(
        tx.query(
          `update public.onboarding_submissions
              set status = 'submitted', submitted_at = now()
            where id = $1`,
          [SUBMISSAO_B],
        ),
        'O BYPASS DO CICLO DE VIDA CONTINUA ABERTO',
      ).rejects.toThrow(/permission denied/)
    }))

  /*
   * Dois casos e não um: a primeira recusa aborta a transação, e uma segunda
   * asserção depois dela mediria "transaction is aborted" em vez da recusa que
   * interessa.
   */
  it('nem a Boop faz UPDATE direto — a porta é uma só, para todo mundo', async () =>
    withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      await expect(
        tx.query(`update public.onboarding_submissions set status = 'draft' where id = $1`, [
          SUBMISSAO_A,
        ]),
      ).rejects.toThrow(/permission denied/)
    }))

  it('nem a Boop faz INSERT direto — abrir onboarding é `start_onboarding`', async () =>
    withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      await expect(
        tx.query(
          `insert into public.onboarding_submissions (project_id, template_id)
           values ($1, $2)`,
          [PROJETO_VELMONT, TEMPLATE_SOCIAL],
        ),
        'A BOOP AINDA ESCOLHE O TEMPLATE PELA TABELA',
      ).rejects.toThrow(/permission denied/)
    }))

  it('ler continua permitido: o que fechou foi a ESCRITA', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query(
        'select id from public.onboarding_submissions where id = $1',
        [SUBMISSAO_A],
      )
      expect(rows).toHaveLength(1)
    }))
})

/* ═══ 2. start_onboarding ══════════════════════════════════════════════════ */

describe('start_onboarding', () => {
  it('a Boop abre com a etapa onboarding corrente', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social novo')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(MEMBRO_A))
      const { rows } = await tx.query<{ r: string }>('select public.start_onboarding($1) as r', [
        projeto,
      ])

      expect(rows[0]?.r).toBe('started')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: submissao } = await tx.query<{ status: string; template_id: string }>(
        'select status, template_id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(submissao[0]?.status).toBe('draft')
      /* O template foi DERIVADO do tipo do projeto, não escolhido por ninguém. */
      expect(submissao[0]?.template_id).toBe(TEMPLATE_SOCIAL)
    }))

  it('grava UMA linha de activity `onboarding.started`', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social activity')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows } = await tx.query<{ n: string; action: string; metadata: unknown }>(
        `select count(*) as n, max(action) as action, max(metadata::text) as metadata
           from public.activity_log where project_id = $1 and action like 'onboarding.%'`,
        [projeto],
      )
      expect(Number(rows[0]?.n)).toBe(1)
      expect(rows[0]?.action).toBe('onboarding.started')
    }))

  it('⚠️ client_user NÃO abre o próprio onboarding', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social do cliente')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(CLIENTE_A))
      await expect(
        tx.query('select public.start_onboarding($1)', [projeto]),
        'O CLIENTE ABRIU O PROPRIO ONBOARDING',
      ).rejects.toThrow(/apenas a Boop/)
    }))

  it('⚠️ member de OUTRO cliente não abre — o uuid é endereço, não prova', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social cross-tenant')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(MEMBRO_B))
      await expect(
        tx.query('select public.start_onboarding($1)', [projeto]),
        'MEMBER DE OUTRO TENANT ABRIU O ONBOARDING',
      ).rejects.toThrow(/sem acesso ao projeto/)
    }))

  it('⚠️ member SEM vínculo nenhum não abre', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social sem vinculo')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(MEMBRO_SEM_VINCULO))
      await expect(tx.query('select public.start_onboarding($1)', [projeto])).rejects.toThrow(
        /sem acesso ao projeto/,
      )
    }))

  it('recusa enquanto a jornada está em kickoff — abrir cedo é abrir errado', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social em kickoff')

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const { rows } = await tx.query<{ r: string }>('select public.start_onboarding($1) as r', [
        projeto,
      ])

      expect(rows[0]?.r).toBe('stage_not_onboarding')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: nenhuma } = await tx.query(
        'select 1 from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(nenhuma, 'criou submissao mesmo recusando').toHaveLength(0)
    }))

  it('tipo de projeto sem template devolve `unsupported`, e não erro', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const { rows: criado } = await tx.query<{ id: string }>(
        `select public.create_project_with_journey($1, 'Site', 'website', 'website.v1', $2::jsonb, null) as id`,
        [
          HARTMANN,
          JSON.stringify([
            { key: 'kickoff', label: 'Início' },
            { key: 'onboarding', label: 'Onboarding' },
          ]),
        ],
      )
      const projeto = criado[0]!.id
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const { rows } = await tx.query<{ r: string }>('select public.start_onboarding($1) as r', [
        projeto,
      ])

      expect(rows[0]?.r).toBe('unsupported')
    }))

  it('abrir duas vezes devolve `already_started` e cria UMA submissão', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social duplo clique')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const primeira = await tx.query<{ r: string }>('select public.start_onboarding($1) as r', [
        projeto,
      ])
      const segunda = await tx.query<{ r: string }>('select public.start_onboarding($1) as r', [
        projeto,
      ])

      expect(primeira.rows[0]?.r).toBe('started')
      expect(segunda.rows[0]?.r, 'duplo clique virou erro').toBe('already_started')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows } = await tx.query(
        'select id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(rows, 'duas submissoes para um projeto').toHaveLength(1)
    }))

  it('⚠️ perfil `disabled` não abre nada, nem chamando a função direto', async () =>
    withIdentity(db, asUser(CLIENTE_A_DESABILITADO), async (tx) => {
      await expect(
        tx.query('select public.start_onboarding($1)', [PROJETO_HARTMANN]),
      ).rejects.toThrow(/apenas a Boop|sem acesso/)
    }))
})

/* ═══ 3. submit_onboarding ═════════════════════════════════════════════════ */

describe('submit_onboarding', () => {
  it('envia e AVANÇA quando a etapa corrente é onboarding', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social submit')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: sub } = await tx.query<{ id: string }>(
        'select id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      await responderObrigatorias(tx, sub[0]!.id)

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows } = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      expect(rows[0]?.r).toBe('advanced')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: etapas } = await tx.query<{ stage_key: string; state: string }>(
        'select stage_key, state from public.project_stages where project_id = $1 order by position',
        [projeto],
      )
      expect(etapas.map((e) => `${e.stage_key}=${e.state}`)).toEqual([
        'kickoff=done',
        'onboarding=done',
        'immersion=current',
      ])

      const { rows: submissao } = await tx.query<{ status: string; submitted_by: string }>(
        'select status, submitted_by from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(submissao[0]?.status).toBe('submitted')
      /* `submitted_by` é `auth.uid()`, nunca parâmetro. */
      expect(submissao[0]?.submitted_by).toBe(CLIENTE_A)
    }))

  it('⚠️ obrigatória vazia RECUSA o envio, e o rascunho continua rascunho', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social incompleto')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows } = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      expect(rows[0]?.r).toBe('required_missing')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: submissao } = await tx.query<{ status: string }>(
        'select status from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(submissao[0]?.status, 'enviou mesmo faltando obrigatoria').toBe('draft')

      const { rows: etapas } = await tx.query<{ stage_key: string }>(
        `select stage_key from public.project_stages where project_id = $1 and state = 'current'`,
        [projeto],
      )
      expect(etapas[0]?.stage_key, 'a jornada andou num envio recusado').toBe('onboarding')
    }))

  it('⚠️ obrigatória com só espaço em branco também recusa', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social em branco')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: sub } = await tx.query<{ id: string }>(
        'select id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      await responderObrigatorias(tx, sub[0]!.id)
      await tx.query(
        `update public.onboarding_answers set value = '"   "'::jsonb
          where submission_id = $1 and question_id = $2`,
        [sub[0]!.id, OBRIGATORIAS[0]![0]],
      )

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows } = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      expect(rows[0]?.r).toBe('required_missing')
    }))

  it('D-21: envia SEM avançar quando a corrente não é onboarding', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social fora de etapa')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: sub } = await tx.query<{ id: string }>(
        'select id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      await responderObrigatorias(tx, sub[0]!.id)

      /* A Boop avançou a jornada à mão antes de o cliente enviar. */
      await tx.query(`update public.project_stages set state = 'pending' where project_id = $1`, [
        projeto,
      ])
      await tx.query(
        `update public.project_stages set state = 'current'
          where project_id = $1 and stage_key = 'immersion'`,
        [projeto],
      )

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows } = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      expect(rows[0]?.r).toBe('submitted_no_advance')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: corrente } = await tx.query<{ stage_key: string }>(
        `select stage_key from public.project_stages where project_id = $1 and state = 'current'`,
        [projeto],
      )
      expect(corrente[0]?.stage_key, 'A JORNADA FOI EMPURRADA').toBe('immersion')

      const { rows: submissao } = await tx.query<{ status: string }>(
        'select status from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(submissao[0]?.status).toBe('submitted')
    }))

  it('⚠️ DUPLO SUBMIT: a jornada avança UMA vez e o log tem UMA linha', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social duplo submit')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: sub } = await tx.query<{ id: string }>(
        'select id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      await responderObrigatorias(tx, sub[0]!.id)

      await switchIdentity(tx, asUser(CLIENTE_A))
      const primeiro = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      const segundo = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])

      expect(primeiro.rows[0]?.r).toBe('advanced')
      /* Sucesso idempotente, e não erro: o duplo clique no celular é o caso
       * comum, não o ataque (docs/workflows.md#idempotência). */
      expect(segundo.rows[0]?.r).toBe('already_submitted')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: corrente } = await tx.query<{ stage_key: string }>(
        `select stage_key from public.project_stages where project_id = $1 and state = 'current'`,
        [projeto],
      )
      expect(corrente[0]?.stage_key, 'DOIS CLIQUES PULARAM UMA ETAPA').toBe('immersion')

      const { rows: log } = await tx.query<{ n: string }>(
        `select count(*) as n from public.activity_log
          where project_id = $1 and action = 'onboarding.completed'`,
        [projeto],
      )
      expect(Number(log[0]?.n), 'dois eventos para um envio').toBe(1)
    }))

  it('⚠️ cliente de OUTRO tenant não envia, mesmo com o projectId correto', async () =>
    withIdentity(db, asUser(CLIENTE_B), async (tx) => {
      await expect(
        tx.query('select public.submit_onboarding($1)', [PROJETO_HARTMANN]),
        'CROSS-TENANT SUBMIT',
      ).rejects.toThrow(/sem acesso ao projeto/)
    }))

  it('⚠️ member de outro tenant não envia', async () =>
    withIdentity(db, asUser(MEMBRO_B), async (tx) => {
      await expect(
        tx.query('select public.submit_onboarding($1)', [PROJETO_HARTMANN]),
      ).rejects.toThrow(/sem acesso ao projeto/)
    }))

  it('⚠️ perfil `disabled` não envia', async () =>
    withIdentity(db, asUser(CLIENTE_A_DESABILITADO), async (tx) => {
      await expect(
        tx.query('select public.submit_onboarding($1)', [PROJETO_HARTMANN]),
      ).rejects.toThrow(/sem acesso ao projeto/)
    }))

  it('projeto sem onboarding aberto devolve `not_started`', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social sem submissao')

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows } = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      expect(rows[0]?.r).toBe('not_started')
    }))

  it('depois de enviado, o cliente NÃO escreve mais resposta nenhuma', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const projeto = await projetoSocial(tx, HARTMANN, 'Social pos envio')
      await correnteEmOnboarding(tx, projeto)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.start_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: sub } = await tx.query<{ id: string }>(
        'select id from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      await responderObrigatorias(tx, sub[0]!.id)

      await switchIdentity(tx, asUser(CLIENTE_A))
      await tx.query('select public.submit_onboarding($1)', [projeto])

      /* `app.can_answer_submission` deixa de conceder: 0 linhas, não erro. */
      const { rowCount } = await tx.query(
        `update public.onboarding_answers set value = '"depois do envio"'::jsonb
          where submission_id = $1 and question_id = $2`,
        [sub[0]!.id, OBRIGATORIAS[0]![0]],
      )
      expect(rowCount, 'CLIENTE EDITOU DEPOIS DE ENVIAR').toBe(0)

      /* E a Boop continua podendo — a trava de estado é só do cliente. */
      await switchIdentity(tx, asUser(MEMBRO_A))
      const daBoop = await tx.query(
        `update public.onboarding_answers set value = '"ajuste da equipe"'::jsonb
          where submission_id = $1 and question_id = $2`,
        [sub[0]!.id, OBRIGATORIAS[0]![0]],
      )
      expect(daBoop.rowCount).toBe(1)
    }))
})

/* ═══ 4. reopen_onboarding ═════════════════════════════════════════════════ */

describe('reopen_onboarding', () => {
  async function enviado(tx: Tx): Promise<{ projeto: string; submissao: string }> {
    const projeto = await projetoSocial(tx, HARTMANN, `Social reopen ${Math.random()}`)
    await correnteEmOnboarding(tx, projeto)

    await switchIdentity(tx, asUser(BOOP_ADMIN))
    await tx.query('select public.start_onboarding($1)', [projeto])

    await switchIdentity(tx, SERVICE_ROLE)
    const { rows } = await tx.query<{ id: string }>(
      'select id from public.onboarding_submissions where project_id = $1',
      [projeto],
    )
    await responderObrigatorias(tx, rows[0]!.id)

    await switchIdentity(tx, asUser(CLIENTE_A))
    await tx.query('select public.submit_onboarding($1)', [projeto])

    return { projeto, submissao: rows[0]!.id }
  }

  it('o admin devolve para draft e limpa a autoria do envio', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto } = await enviado(tx)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const { rows } = await tx.query<{ r: string }>('select public.reopen_onboarding($1) as r', [
        projeto,
      ])
      expect(rows[0]?.r).toBe('reopened')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: submissao } = await tx.query<{
        status: string
        submitted_at: string | null
        submitted_by: string | null
      }>(
        'select status, submitted_at, submitted_by from public.onboarding_submissions where project_id = $1',
        [projeto],
      )
      expect(submissao[0]?.status).toBe('draft')
      expect(submissao[0]?.submitted_at).toBeNull()
      expect(submissao[0]?.submitted_by).toBeNull()
    }))

  it('⚠️ a JORNADA não volta no tempo', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto } = await enviado(tx)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.reopen_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows } = await tx.query<{ stage_key: string; state: string }>(
        'select stage_key, state from public.project_stages where project_id = $1 order by position',
        [projeto],
      )
      expect(
        rows.map((r) => `${r.stage_key}=${r.state}`),
        'REABRIR REESCREVEU O HISTORICO DA JORNADA',
      ).toEqual(['kickoff=done', 'onboarding=done', 'immersion=current'])
    }))

  it('o envio anterior sobrevive no log — é o que permite limpar a linha', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto } = await enviado(tx)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.reopen_onboarding($1)', [projeto])

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows } = await tx.query<{ action: string }>(
        `select action from public.activity_log
          where project_id = $1 and action like 'onboarding.%' order by id`,
        [projeto],
      )
      expect(rows.map((r) => r.action)).toEqual([
        'onboarding.started',
        'onboarding.completed',
        'onboarding.reopened',
      ])
    }))

  it('o cliente volta a poder editar, e reenviar NÃO empurra a jornada', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto, submissao } = await enviado(tx)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      await tx.query('select public.reopen_onboarding($1)', [projeto])

      await switchIdentity(tx, asUser(CLIENTE_A))
      const corrigiu = await tx.query(
        `update public.onboarding_answers set value = '"resposta corrigida"'::jsonb
          where submission_id = $1 and question_id = $2`,
        [submissao, OBRIGATORIAS[0]![0]],
      )
      expect(corrigiu.rowCount, 'o cliente nao voltou a poder editar').toBe(1)

      const { rows } = await tx.query<{ r: string }>('select public.submit_onboarding($1) as r', [
        projeto,
      ])
      /* A consequência intencional de D-21 + D-22. */
      expect(rows[0]?.r).toBe('submitted_no_advance')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: corrente } = await tx.query<{ stage_key: string }>(
        `select stage_key from public.project_stages where project_id = $1 and state = 'current'`,
        [projeto],
      )
      expect(corrente[0]?.stage_key, 'O REENVIO PULOU A IMERSAO').toBe('immersion')
    }))

  it('reabrir duas vezes é idempotente', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto } = await enviado(tx)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const primeira = await tx.query<{ r: string }>('select public.reopen_onboarding($1) as r', [
        projeto,
      ])
      const segunda = await tx.query<{ r: string }>('select public.reopen_onboarding($1) as r', [
        projeto,
      ])

      expect(primeira.rows[0]?.r).toBe('reopened')
      expect(segunda.rows[0]?.r).toBe('already_draft')
    }))

  it('⚠️ boop_member NÃO reabre — a operação é do admin', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto } = await enviado(tx)

      await switchIdentity(tx, asUser(MEMBRO_A))
      await expect(
        tx.query('select public.reopen_onboarding($1)', [projeto]),
        'MEMBER REABRIU UM ENVIO',
      ).rejects.toThrow(/apenas um admin/)
    }))

  it('⚠️ client_user NÃO reabre o próprio envio', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { projeto } = await enviado(tx)

      await switchIdentity(tx, asUser(CLIENTE_A))
      await expect(tx.query('select public.reopen_onboarding($1)', [projeto])).rejects.toThrow(
        /apenas um admin/,
      )
    }))
})

/* ═══ 5. Isolamento de leitura ═════════════════════════════════════════════ */

describe('isolamento: submissões e respostas', () => {
  it('cliente A lê a própria submissão; a do B, não', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const propria = await tx.query('select 1 from public.onboarding_submissions where id = $1', [
        SUBMISSAO_A,
      ])
      expect(propria.rows).toHaveLength(1)

      const alheia = await tx.query('select 1 from public.onboarding_submissions where id = $1', [
        SUBMISSAO_B,
      ])
      expect(alheia.rows, 'O CLIENTE LEU A SUBMISSAO DE OUTRO TENANT').toHaveLength(0)
    }))

  it('cliente A não lê resposta do cliente B, nem com o id certo', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query(
        'select 1 from public.onboarding_answers where submission_id = $1',
        [SUBMISSAO_B],
      )
      expect(rows, 'O CLIENTE LEU RESPOSTA DE OUTRO TENANT').toHaveLength(0)
    }))

  it('member vinculado lê o seu lado e não o outro', async () =>
    withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      const seu = await tx.query('select 1 from public.onboarding_submissions where id = $1', [
        SUBMISSAO_A,
      ])
      expect(seu.rows).toHaveLength(1)

      const outro = await tx.query('select 1 from public.onboarding_submissions where id = $1', [
        SUBMISSAO_B,
      ])
      expect(outro.rows, 'MEMBER LEU O OUTRO TENANT').toHaveLength(0)
    }))

  it('member sem vínculo não lê submissão nenhuma', async () =>
    withIdentity(db, asUser(MEMBRO_SEM_VINCULO), async (tx) => {
      const { rows } = await tx.query('select 1 from public.onboarding_submissions')
      expect(rows).toHaveLength(0)
    }))

  it('perfil `disabled` não lê a submissão do próprio cliente', async () =>
    withIdentity(db, asUser(CLIENTE_A_DESABILITADO), async (tx) => {
      const { rows } = await tx.query('select 1 from public.onboarding_submissions where id = $1', [
        SUBMISSAO_A,
      ])
      expect(rows, 'PERFIL DESLIGADO CONTINUOU LENDO').toHaveLength(0)
    }))

  it('⚠️ reatribuir uma resposta para outra submissão falha', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await expect(
        tx.query(
          `update public.onboarding_answers set submission_id = $1
            where submission_id = $2`,
          [SUBMISSAO_B, SUBMISSAO_A],
        ),
        'RESPOSTA MIGROU DE SUBMISSAO',
      ).rejects.toThrow()
    }))

  it('⚠️ trocar a pergunta de uma resposta existente falha', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await expect(
        tx.query(
          `update public.onboarding_answers set question_id = $1
            where submission_id = $2 and question_id = $3`,
          [OBRIGATORIAS[1]![0], SUBMISSAO_A, OBRIGATORIAS[0]![0]],
        ),
      ).rejects.toThrow()
    }))
})

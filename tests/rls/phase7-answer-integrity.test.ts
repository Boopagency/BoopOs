/**
 * FASE 7 — a integridade da resposta, contra Postgres real.
 *
 * Duas coisas se provam aqui, e a segunda é a que mais importa:
 *
 * 1. **O trigger recusa o que tem de recusar.** Pergunta de outro template,
 *    pergunta inexistente, valor com a forma errada, opção fora do template. E
 *    recusa para TODO papel — inclusive `service_role`, que ignora RLS —,
 *    porque é invariante de dado, não autorização.
 *
 * 2. **As duas implementações da semântica concordam.** `app.answer_is_present`
 *    e `isAnswerPresent` respondem sobre a mesma tabela de casos, e o teste
 *    compara resposta por resposta. É o que impede o formulário de dizer
 *    "pode enviar" enquanto o `submit_onboarding` conta uma obrigatória
 *    faltando — ou o contrário, que é pior: o formulário barrando alguém que
 *    respondeu.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { isAnswerPresent, isAnswerShapeValid } from '@/domains/onboarding/answers'
import { asUser, connect, SERVICE_ROLE, switchIdentity, withIdentity, type Tx } from './support/db'
import { CLIENTE_A, CLIENTE_B, SUBMISSAO_A } from './support/fixtures'
import { ANSWER_CASES } from '../support/answer-cases'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

/** A submissão da Velmont, que o seed deixa em `draft`. */
const SUBMISSAO_B = '43000000-0000-4000-8000-000000000002'
/** `why`, do template social: `long_text`, obrigatória. */
const PERGUNTA_TEXTO = '42000000-0000-4000-8000-000000000001'
/** `revenue`: `single_select` com cinco alternativas. */
const PERGUNTA_ESCOLHA = '42000000-0000-4000-8000-000000000003'

/** Um template completo que NENHUMA submissão do seed usa. */
async function templateEstrangeiro(tx: Tx): Promise<string> {
  const template = '40000000-0000-4000-8000-0000000000e1'
  const secao = '41000000-0000-4000-8000-0000000000e1'
  const pergunta = '42000000-0000-4000-8000-0000000000e1'

  await tx.query(
    `insert into public.onboarding_templates (id, key, name, project_type, version, is_active)
     values ($1, 'estrangeiro', 'Estrangeiro', 'website', 1, true)`,
    [template],
  )
  await tx.query(
    `insert into public.onboarding_sections (id, template_id, key, title, position)
     values ($1, $2, 'unica', 'Única', 1)`,
    [secao, template],
  )
  await tx.query(
    `insert into public.onboarding_questions (id, section_id, key, label, type, is_required, position)
     values ($1, $2, 'pergunta', 'Pergunta de outro formulário', 'long_text', false, 1)`,
    [pergunta, secao],
  )

  return pergunta
}

describe('a pergunta tem que ser do template da submissão', () => {
  it('⚠️ SPOOF: o dono da submissão NÃO grava resposta de pergunta de outro template', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const estrangeira = await templateEstrangeiro(tx)

      /* Cliente A, na PRÓPRIA submissão. Autorização em ordem: o que falha é a
       * integridade — a pergunta não pertence ao formulário que ele responde. */
      await switchIdentity(tx, asUser(CLIENTE_A))

      await expect(
        tx.query(
          `insert into public.onboarding_answers (submission_id, question_id, value)
           values ($1, $2, '"invadido"'::jsonb)`,
          [SUBMISSAO_A, estrangeira],
        ),
        'RESPOSTA DE PERGUNTA DE OUTRO TEMPLATE FOI ACEITA',
      ).rejects.toThrow(/pertence ao template/)
    }))

  it('⚠️ nem service_role escapa: a invariante vale para o papel mais poderoso', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const estrangeira = await templateEstrangeiro(tx)

      await expect(
        tx.query(
          `insert into public.onboarding_answers (submission_id, question_id, value)
           values ($1, $2, '"pelo papel que ignora RLS"'::jsonb)`,
          [SUBMISSAO_A, estrangeira],
        ),
        'A INVARIANTE DEPENDIA DA RLS',
      ).rejects.toThrow(/pertence ao template/)
    }))

  it('pergunta inexistente é recusada antes de qualquer coisa', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await expect(
        tx.query(
          `insert into public.onboarding_answers (submission_id, question_id, value)
           values ($1, '42000000-0000-4000-8000-0000000000ff', '"fantasma"'::jsonb)`,
          [SUBMISSAO_A],
        ),
      ).rejects.toThrow(/pergunta inexistente|violates foreign key/)
    }))

  it('a pergunta do PRÓPRIO template passa — a trava não é geral', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await switchIdentity(tx, asUser(CLIENTE_B))

      const { rowCount } = await tx.query(
        `insert into public.onboarding_answers (submission_id, question_id, value)
         values ($1, $2, '"resposta legitima"'::jsonb)
         on conflict (submission_id, question_id) do update set value = excluded.value`,
        [SUBMISSAO_B, PERGUNTA_TEXTO],
      )

      expect(rowCount).toBe(1)
    }))
})

describe('o valor tem que ter a forma do tipo', () => {
  it('⚠️ opção que não existe no template é recusada', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await switchIdentity(tx, asUser(CLIENTE_B))

      await expect(
        tx.query(
          `insert into public.onboarding_answers (submission_id, question_id, value)
           values ($1, $2, '"Opção Inventada"'::jsonb)
           on conflict (submission_id, question_id) do update set value = excluded.value`,
          [SUBMISSAO_B, PERGUNTA_ESCOLHA],
        ),
        'ESCOLHA FORA DO TEMPLATE FOI ACEITA',
      ).rejects.toThrow(/valor invalido/)
    }))

  it('número onde se espera texto é recusado', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await switchIdentity(tx, asUser(CLIENTE_B))

      await expect(
        tx.query(
          `insert into public.onboarding_answers (submission_id, question_id, value)
           values ($1, $2, '42'::jsonb)
           on conflict (submission_id, question_id) do update set value = excluded.value`,
          [SUBMISSAO_B, PERGUNTA_TEXTO],
        ),
      ).rejects.toThrow(/valor invalido/)
    }))

  it('texto vazio passa: é o rascunho apagando o campo', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await switchIdentity(tx, asUser(CLIENTE_B))

      const { rowCount } = await tx.query(
        `insert into public.onboarding_answers (submission_id, question_id, value)
         values ($1, $2, '""'::jsonb)
         on conflict (submission_id, question_id) do update set value = excluded.value`,
        [SUBMISSAO_B, PERGUNTA_TEXTO],
      )

      expect(rowCount).toBe(1)
    }))

  it('o UPDATE também passa pelo trigger, não só o INSERT', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      await tx.query(
        `insert into public.onboarding_answers (submission_id, question_id, value)
         values ($1, $2, '"valida"'::jsonb)
         on conflict (submission_id, question_id) do update set value = excluded.value`,
        [SUBMISSAO_B, PERGUNTA_TEXTO],
      )

      await expect(
        tx.query(
          `update public.onboarding_answers set value = 'true'::jsonb
            where submission_id = $1 and question_id = $2`,
          [SUBMISSAO_B, PERGUNTA_TEXTO],
        ),
        'UPDATE ESCAPOU DA VALIDACAO DE FORMA',
      ).rejects.toThrow(/valor invalido/)
    }))
})

describe('PARIDADE: a semântica é a mesma em SQL e em TypeScript', () => {
  /*
   * O teste que existe para o dia em que alguém mudar uma das duas
   * implementações e não a outra. Sem ele, a divergência aparece em produção
   * como "o botão deixou enviar e o servidor recusou" — ou pior, como um
   * formulário barrando quem respondeu `false` numa obrigatória booleana.
   */
  it('as duas funções concordam sobre todos os casos, um a um', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      for (const caso of ANSWER_CASES) {
        const valor = caso.value === undefined ? null : JSON.stringify(caso.value)
        const options = JSON.stringify(caso.options)

        const { rows } = await tx.query<{ valida: boolean; presente: boolean }>(
          `select app.answer_value_is_valid($1::public.question_type, $2::jsonb, $3::jsonb) as valida,
                  app.answer_is_present($1::public.question_type, $3::jsonb)                as presente`,
          [caso.type, options, valor],
        )

        const banco = rows[0]
        expect(banco, caso.nome).toBeDefined()

        expect(banco?.valida, `SQL discorda da tabela em "${caso.nome}" (forma)`).toBe(caso.valida)
        expect(banco?.presente, `SQL discorda da tabela em "${caso.nome}" (preenchida)`).toBe(
          caso.presente,
        )

        expect(
          isAnswerShapeValid(caso.type, caso.options, caso.value),
          `TypeScript discorda do SQL em "${caso.nome}" (forma)`,
        ).toBe(banco?.valida)

        expect(
          isAnswerPresent(caso.type, caso.value),
          `TypeScript discorda do SQL em "${caso.nome}" (preenchida)`,
        ).toBe(banco?.presente)
      }
    }))

  it('a tabela de casos cobre todo tipo do enum — nenhum fica sem prova', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const { rows } = await tx.query<{ tipo: string }>(
        `select unnest(enum_range(null::public.question_type))::text as tipo`,
      )

      const cobertos = new Set(ANSWER_CASES.map((caso) => caso.type))
      const descobertos = rows.map((r) => r.tipo).filter((tipo) => !cobertos.has(tipo as never))

      expect(descobertos, `tipos sem caso: ${descobertos.join(', ')}`).toEqual([])
    }))
})

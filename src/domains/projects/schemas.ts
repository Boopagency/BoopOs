import { z } from 'zod'
import { PROJECT_TYPES, STAGE_STATES } from '@/config/enums'

/**
 * Entrada dos workflows de projeto. Zod `.strict()`, sempre.
 *
 * O que NÃO aparece em nenhum schema, e por quê:
 *
 *   `id`           gerado pelo banco.
 *   `journeyKey`   **derivado do `type`** por `JOURNEY_BY_TYPE`, no servidor.
 *                  Aceitá-lo do formulário deixaria quem posta escolher a
 *                  jornada independentemente do tipo — que é exatamente a
 *                  incoerência que a migration de imutabilidade fecha do outro
 *                  lado. Ele também não é vocabulário de produto: quem cria um
 *                  projeto escolhe "Social media", não `social.v1`.
 *   `status`       nasce `draft` por default do banco. Mudar é workflow com
 *                  capacidade própria (`project.change_status`).
 *   `cycle`        nasce 1. Quem o incrementa é o review (FASE 15).
 *   `created_by`   vem do ator, dentro da função SQL.
 *   `clientId` em `updateProject`  — o projeto já tem cliente, e ele é imutável
 *                  no banco. Aceitá-lo aqui seria oferecer uma mudança que o
 *                  trigger recusa.
 *
 * `type` também não está em `updateProjectSchema`: `type` e `journey_key` são
 * imutáveis desde `20260903010349_immutable_journey_binding.sql`, porque as
 * etapas já materializadas não podem discordar do template que as gerou.
 * Oferecer o campo produziria um formulário que salva e o banco rejeita.
 */

const clientId = z.uuid({ error: 'client_id_invalid' })
const projectId = z.uuid({ error: 'project_id_invalid' })
const stageId = z.uuid({ error: 'stage_id_invalid' })

const name = z
  .string()
  .trim()
  .min(2, { error: 'name_too_short' })
  .max(120, { error: 'name_too_long' })

const projectType = z.enum(PROJECT_TYPES, { error: 'type_invalid' })

/**
 * Data opcional de verdade.
 *
 * `starts_on` é nullable no banco e a FASE 6 não muda isso: um projeto pode ser
 * cadastrado antes de a data estar combinada. String vazia — que é o que um
 * `<input type="date">` não preenchido manda — vira `null`, e não uma data
 * inventada de hoje. A tela omite a linha quando não há data.
 */
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: 'date_invalid',
  })

export const createProjectSchema = z
  .object({ clientId, name, type: projectType, startsOn: optionalDate })
  .strict()

/**
 * Edição administrativa. Quatro campos, e são os que não afetam a jornada.
 *
 * `endsOn` entra junto com `startsOn` porque o banco tem
 * `check (ends_on >= starts_on)`: editar um sem o outro tornaria possível
 * salvar um par que o check recusa sem que a tela pudesse explicar qual dos
 * dois estava errado.
 */
export const updateProjectSchema = z
  .object({ projectId, name, startsOn: optionalDate, endsOn: optionalDate })
  .strict()
  .refine(
    (input) => input.startsOn === null || input.endsOn === null || input.endsOn >= input.startsOn,
    { error: 'period_invalid', path: ['endsOn'] },
  )

/**
 * Transição de status. O enum inteiro, e não um literal reduzido.
 *
 * Diferente de `setClientStatusSchema`, que exclui `archived` para impedir que
 * `client.update` contorne `client.archive`: em projeto **não há essa
 * assimetria**. A matriz tem uma linha só — `project.change_status` — e ela é
 * da Boop inteira, arquivamento incluído (docs/permissions.md). Recortar o
 * enum aqui inventaria uma regra que a matriz não tem.
 *
 * `draft` fica de fora por outro motivo: é o estado de nascimento, e voltar
 * para ele diria que o projeto nunca começou. As transições legítimas são
 * conferidas em `mutations.ts`, contra o estado lido do banco.
 */
export const changeProjectStatusSchema = z
  .object({
    projectId,
    status: z.literal(['active', 'paused', 'completed', 'archived']),
  })
  .strict()

export const advanceStageSchema = z.object({ projectId }).strict()

/**
 * A correção manual. Aceita os quatro estados, inclusive `current`.
 *
 * `current` é o caso que exige transação — a corrente anterior precisa sair no
 * mesmo gesto —, e é resolvido dentro de `set_project_stage_state()`.
 */
export const setStageStateSchema = z
  .object({ projectId, stageId, state: z.enum(STAGE_STATES, { error: 'state_invalid' }) })
  .strict()

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type ChangeProjectStatusInput = z.infer<typeof changeProjectStatusSchema>
export type AdvanceStageInput = z.infer<typeof advanceStageSchema>
export type SetStageStateInput = z.infer<typeof setStageStateSchema>

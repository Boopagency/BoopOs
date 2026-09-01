/**
 * Os identificadores do `supabase/seed.sql`, com nome.
 *
 * A suite le por estes nomes e nunca por UUID solto: `CLIENTE_A` diz o que
 * esta sob teste, `'20000000-…'` nao diz nada. Mudou o seed, muda aqui — e o
 * `seed.test.ts` quebra antes de qualquer outro, apontando o lugar certo.
 */

export const HARTMANN = '20000000-0000-4000-8000-000000000001'
export const VELMONT = '20000000-0000-4000-8000-000000000002'

export const PROJETO_HARTMANN = '30000000-0000-4000-8000-000000000001'
export const PROJETO_VELMONT = '30000000-0000-4000-8000-000000000002'

/** Papel global boop_admin: enxerga tudo, por D-08. Nao aprova nada. */
export const BOOP_ADMIN = '10000000-0000-4000-8000-000000000001'
/** boop_member vinculado SOMENTE a Hartmann. */
export const MEMBRO_A = '10000000-0000-4000-8000-000000000002'
/** boop_member vinculado SOMENTE a Velmont. */
export const MEMBRO_B = '10000000-0000-4000-8000-000000000003'
/** boop_member sem vinculo nenhum: o caso negativo puro. */
export const MEMBRO_SEM_VINCULO = '10000000-0000-4000-8000-000000000004'
/** client_user da Hartmann. E quem aprova, do lado A. */
export const CLIENTE_A = '10000000-0000-4000-8000-000000000005'
/** client_user da Velmont. */
export const CLIENTE_B = '10000000-0000-4000-8000-000000000006'
/** Vinculada a Hartmann, porem `disabled`: vinculo sem acesso. */
export const CLIENTE_A_DESABILITADO = '10000000-0000-4000-8000-000000000007'

/** Conteudo em `awaiting_client`: o cliente A pode ver. */
export const CONTEUDO_A_VISIVEL = '60000000-0000-4000-8000-000000000003'
/** Conteudo em `in_production`: o cliente A NAO pode ver, mesmo sendo dele. */
export const CONTEUDO_A_INTERNO = '60000000-0000-4000-8000-000000000002'
/** Conteudo da Velmont em `awaiting_client`: invisivel para o cliente A. */
export const CONTEUDO_B_VISIVEL = '60000000-0000-4000-8000-000000000007'

export const VERSAO_A_AGUARDANDO = '61000000-0000-4000-8000-000000000002'
export const VERSAO_A_RASCUNHO = '61000000-0000-4000-8000-000000000001'
export const VERSAO_B_AGUARDANDO = '61000000-0000-4000-8000-000000000007'

export const COMENTARIO_PUBLICO = '62000000-0000-4000-8000-000000000001'
export const COMENTARIO_INTERNO = '62000000-0000-4000-8000-000000000003'

export const ESTRATEGIA_A = '50000000-0000-4000-8000-000000000001'
export const VERSAO_ESTRATEGIA_A_APROVADA = '51000000-0000-4000-8000-000000000001'
export const VERSAO_ESTRATEGIA_A_RASCUNHO = '51000000-0000-4000-8000-000000000002'

export const SUBMISSAO_A = '43000000-0000-4000-8000-000000000001'

/** Todas as tabelas de `public` no Marco 1. A ordem e a das migrations. */
export const TABELAS = [
  'profiles',
  'clients',
  'client_memberships',
  'projects',
  'project_stages',
  'onboarding_templates',
  'onboarding_sections',
  'onboarding_questions',
  'onboarding_submissions',
  'onboarding_answers',
  'strategies',
  'strategy_versions',
  'strategy_approvals',
  'content_items',
  'content_versions',
  'content_comments',
  'content_approvals',
  'activity_log',
  'notifications',
] as const

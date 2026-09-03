/**
 * Catalogo de acoes do activity log.
 *
 * A constraint da tabela (`action ~ '^[a-z_]+\.[a-z_]+$'`) garante o formato;
 * este arquivo garante o vocabulario. `dominio.verbo_no_passado`, sempre.
 *
 * Cresce uma fase por vez, e de proposito: o catalogo inteiro de
 * docs/workflows.md listado aqui hoje seria uma lista de acoes que nenhum
 * codigo emite, e ninguem saberia quais ja valem.
 *
 * FASE 3 emitiu uma. FASE 5 acrescentou as seis de `docs/workflows.md#clientes-
 * e-usuarios`. FASE 6 acrescenta as quatro de projeto, e nenhuma alem delas —
 * nome de evento inventado polui auditoria e nunca mais sai, porque a tabela e
 * append-only.
 *
 * ⚠️ Tres das quatro de projeto NAO sao emitidas por `logActivity()`: quem as
 * grava sao as funcoes SQL de `20260903010440_project_journey_boundaries.sql`,
 * de dentro da transacao que muda o dominio. O catalogo vale igual — o formato
 * e conferido pelo `check` da tabela, e o vocabulario, por este arquivo e pelo
 * teste que le as duas pontas.
 *
 * Duas ausencias deliberadas:
 *
 *   `client.restored`   desarquivar e uma mudanca de status como outra
 *                       qualquer, e sai como `client.updated` com
 *                       `metadata.status`. Um verbo proprio para o inverso de
 *                       cada verbo dobraria o catalogo sem dobrar a informacao.
 *   `user.role_changed` trocar o papel de quem ja trabalha no sistema nao esta
 *                       na matriz e nao tem caminho (FASE 5). O papel definido
 *                       no convite viaja em `metadata.role` de `client.invited`.
 */
export const ACTIVITY_ACTIONS = [
  'user.joined',
  'client.created',
  'client.updated',
  'client.archived',
  'client.invited',
  'membership.granted',
  'membership.revoked',
  'user.disabled',
  /*
   * FASE 6 — projetos e jornada. Quatro verbos, e a escolha de cada um:
   *
   *   `project.created`         cria o projeto E materializa a jornada. Um
   *                             evento, porque é uma transacao (a funcao SQL
   *                             grava esta linha de dentro dela).
   *   `project.updated`         nome e periodo.
   *   `project.status_changed`  draft -> active -> paused -> completed ->
   *                             archived. Verbo proprio, e nao `updated` com
   *                             metadata, porque status e a mudanca que o
   *                             cliente sente: e a que decide se o projeto
   *                             aparece no portal.
   *   `project.stage_changed`   avanco E correcao manual. Um verbo para os
   *                             dois: o que aconteceu com a jornada e o mesmo
   *                             fato — uma etapa mudou de estado —, e a
   *                             diferenca vive em `metadata.correction`.
   *
   * Nao existe `project.archived` separado: arquivar e uma transicao de status
   * como as outras, e sai como `project.status_changed`. A mesma decisao de
   * `client.restored`, escrita acima.
   *
   * Nao existe `project.stage_advanced` + `project.stage_corrected`: seria
   * dobrar o vocabulario sem dobrar a informacao, e o log e append-only — nome
   * de evento inventado nunca mais sai.
   */
  'project.created',
  'project.updated',
  'project.status_changed',
  'project.stage_changed',
  /*
   * FASE 7 — onboarding. Tres verbos, e a ausencia de um quarto e a decisao
   * mais importante do grupo:
   *
   *   `onboarding.started`    a Boop abriu o formulario para o cliente.
   *   `onboarding.completed`  o cliente enviou. Gravado DENTRO de
   *                           `submit_onboarding()`, junto com o avanco da
   *                           etapa, entao o workflow nao chama
   *                           `ctx.activity()` — chamar produziria duas linhas.
   *   `onboarding.reopened`   um admin devolveu a submissao para `draft`.
   *
   * NAO existe `onboarding.answer_saved`. O autosave dispara a cada debounce,
   * por PERGUNTA: registra-lo encheria uma tabela append-only de centenas de
   * linhas por onboarding, e nenhuma delas responderia uma pergunta de
   * auditoria. O que importa auditar e quando o formulario abriu, quando foi
   * enviado e quando foi reaberto (docs/workflows.md).
   *
   * O verbo e `completed`, e nao `submitted`: o catalogo canonico de
   * docs/workflows.md decidiu, e um vocabulario com dois nomes para o mesmo
   * fato nunca mais sai de um log append-only.
   */
  'onboarding.started',
  'onboarding.completed',
  'onboarding.reopened',
] as const

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

/**
 * `entity_type` e texto livre no banco. Aqui ele e fechado, para que duas
 * fases nao escrevam "profile" e "user" para a mesma coisa.
 */
export const ACTIVITY_ENTITY_TYPES = [
  'profile',
  'client',
  'client_membership',
  'project',
  'project_stage',
  'onboarding_submission',
] as const
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number]

/**
 * Rotulo em pt-BR de cada acao, para a tela de atividade da Boop.
 *
 * Fica aqui, ao lado do catalogo, porque uma acao nova sem rotulo quebra o
 * `Record` e o typecheck cobra — em vez de aparecer na tela como
 * "membership.granted".
 */
export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  'user.joined': 'entrou pela primeira vez',
  'client.created': 'criou o cliente',
  'client.updated': 'editou o cliente',
  'client.archived': 'arquivou o cliente',
  'client.invited': 'convidou',
  'membership.granted': 'deu acesso a',
  'membership.revoked': 'removeu o acesso de',
  'user.disabled': 'desligou',
  'project.created': 'criou o projeto',
  'project.updated': 'editou o projeto',
  'project.status_changed': 'mudou o status do projeto',
  'project.stage_changed': 'moveu a jornada de',
  'onboarding.started': 'abriu o onboarding de',
  'onboarding.completed': 'enviou o onboarding de',
  'onboarding.reopened': 'reabriu o onboarding de',
}

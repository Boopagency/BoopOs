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
 * FASE 3 emitiu uma. FASE 5 acrescenta as seis de `docs/workflows.md#clientes-
 * e-usuarios`, e nenhuma alem delas — nome de evento inventado polui auditoria
 * e nunca mais sai, porque a tabela e append-only.
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
] as const

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

/**
 * `entity_type` e texto livre no banco. Aqui ele e fechado, para que duas
 * fases nao escrevam "profile" e "user" para a mesma coisa.
 */
export const ACTIVITY_ENTITY_TYPES = ['profile', 'client', 'client_membership'] as const
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
}

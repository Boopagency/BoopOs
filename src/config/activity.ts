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
 * FASE 3 emite uma unica acao.
 */
export const ACTIVITY_ACTIONS = ['user.joined'] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

/**
 * `entity_type` e texto livre no banco. Aqui ele e fechado, para que duas
 * fases nao escrevam "profile" e "user" para a mesma coisa.
 */
export const ACTIVITY_ENTITY_TYPES = ['profile'] as const
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number]

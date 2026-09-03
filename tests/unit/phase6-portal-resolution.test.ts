/**
 * FASE 6 — a resolucao de `/portal` e a visibilidade por status.
 *
 * O que esta sob teste e a decisao que substituiu `DEMO_PROJECT_ID`: com quais
 * projetos `/portal` redireciona, com quais mostra escolha, e quais um
 * `client_user` nao pode alcancar de jeito nenhum (D-18, D-19).
 *
 * Puro, sem banco: `isPortalVisible`, `isPortalResolvable` e
 * `resolvePortalEntry` nao consultam nada. Quem prova a camada do banco e
 * `tests/rls/phase6-*`.
 */
import { describe, expect, it } from 'vitest'
import type { ProjectStatus } from '@/config/enums'
import type { Actor } from '@/lib/auth/actor'
import {
  isPortalResolvable,
  isPortalVisible,
  resolvePortalEntry,
} from '@/domains/projects/visibility'
import type { ProjectPublic } from '@/domains/projects/types'

const CLIENTE: Actor = {
  userId: 'u-cliente',
  email: 'cliente@example.com',
  fullName: 'Cliente',
  role: 'client_user',
  status: 'active',
}

const ADMIN: Actor = { ...CLIENTE, userId: 'u-admin', role: 'boop_admin' }
const MEMBRO: Actor = { ...CLIENTE, userId: 'u-membro', role: 'boop_member' }

const TODOS: ProjectStatus[] = ['draft', 'active', 'paused', 'completed', 'archived']

function projeto(id: string, status: ProjectStatus): ProjectPublic {
  return {
    id,
    clientId: 'c1',
    name: `Projeto ${id}`,
    type: 'social',
    status,
    cycle: 1,
    startedOn: null,
  }
}

describe('isPortalVisible — o que pode ser ABERTO por URL direta', () => {
  it('client_user NUNCA abre um draft', () => {
    expect(isPortalVisible('draft', CLIENTE)).toBe(false)
  })

  it('client_user abre active e paused — o trabalho corrente', () => {
    expect(isPortalVisible('active', CLIENTE)).toBe(true)
    expect(isPortalVisible('paused', CLIENTE)).toBe(true)
  })

  it('client_user abre completed e archived — e o historico dele', () => {
    expect(isPortalVisible('completed', CLIENTE)).toBe(true)
    expect(isPortalVisible('archived', CLIENTE)).toBe(true)
  })

  it('a Boop abre TODOS os status, draft incluido', () => {
    for (const status of TODOS) {
      expect(isPortalVisible(status, ADMIN), `admin/${status}`).toBe(true)
      expect(isPortalVisible(status, MEMBRO), `membro/${status}`).toBe(true)
    }
  })

  it('draft e o UNICO status escondido do cliente', () => {
    const escondidos = TODOS.filter((s) => !isPortalVisible(s, CLIENTE))
    expect(escondidos).toEqual(['draft'])
  })
})

describe('isPortalResolvable — o que entra na resolucao AUTOMATICA', () => {
  it('active e paused resolvem', () => {
    expect(isPortalResolvable('active', CLIENTE)).toBe(true)
    expect(isPortalResolvable('paused', CLIENTE)).toBe(true)
  })

  it('completed e archived NAO resolvem — alcancaveis, nunca automaticos', () => {
    expect(isPortalResolvable('completed', CLIENTE)).toBe(false)
    expect(isPortalResolvable('archived', CLIENTE)).toBe(false)
    /* E a diferenca entre as duas perguntas: visivel sim, automatico nao. */
    expect(isPortalVisible('completed', CLIENTE)).toBe(true)
  })

  it('draft nao resolve nem para a Boop — resolver e sobre onde o trabalho esta', () => {
    expect(isPortalResolvable('draft', ADMIN)).toBe(false)
  })
})

describe('resolvePortalEntry', () => {
  it('ZERO projetos: estado vazio, nunca 404', () => {
    expect(resolvePortalEntry([], CLIENTE)).toEqual({ kind: 'empty' })
  })

  it('UM projeto resolvivel: redireciona direto, sem seletor', () => {
    const p = projeto('a', 'active')
    expect(resolvePortalEntry([p], CLIENTE)).toEqual({ kind: 'single', project: p })
  })

  it('DOIS ou mais: mostra a escolha, nunca escolhe o primeiro', () => {
    const resultado = resolvePortalEntry([projeto('a', 'active'), projeto('b', 'active')], CLIENTE)
    expect(resultado.kind).toBe('choice')
    if (resultado.kind === 'choice') expect(resultado.projects).toHaveLength(2)
  })

  it('so DRAFT para o cliente: vazio — o rascunho nao existe para ele', () => {
    expect(resolvePortalEntry([projeto('a', 'draft')], CLIENTE)).toEqual({ kind: 'empty' })
  })

  it('so DRAFT para a Boop: tambem vazio — visivel nao e resolvivel', () => {
    /* O admin ALCANCA o rascunho por URL; o portal so nao o escolhe sozinho. */
    expect(isPortalVisible('draft', ADMIN)).toBe(true)
    expect(resolvePortalEntry([projeto('a', 'draft')], ADMIN)).toEqual({ kind: 'empty' })
  })

  it('so COMPLETED: vazio — nao manda o cliente para um projeto encerrado', () => {
    expect(resolvePortalEntry([projeto('a', 'completed')], CLIENTE)).toEqual({ kind: 'empty' })
  })

  it('so ARCHIVED: vazio', () => {
    expect(resolvePortalEntry([projeto('a', 'archived')], CLIENTE)).toEqual({ kind: 'empty' })
  })

  it('PAUSED resolve: pausa e informacao, nao ausencia', () => {
    const p = projeto('a', 'paused')
    expect(resolvePortalEntry([p], CLIENTE)).toEqual({ kind: 'single', project: p })
  })

  it('um ativo entre encerrados: redireciona para o ativo', () => {
    const ativo = projeto('vivo', 'active')
    const resultado = resolvePortalEntry(
      [projeto('velho', 'archived'), ativo, projeto('antigo', 'completed')],
      CLIENTE,
    )
    expect(resultado).toEqual({ kind: 'single', project: ativo })
  })

  it('draft NAO conta para virar escolha: um ativo + um rascunho = redirect', () => {
    const ativo = projeto('a', 'active')
    expect(resolvePortalEntry([ativo, projeto('b', 'draft')], CLIENTE)).toEqual({
      kind: 'single',
      project: ativo,
    })
  })

  it('e DETERMINISTICO: a mesma entrada da sempre a mesma saida', () => {
    const entrada = [projeto('a', 'active'), projeto('b', 'paused'), projeto('c', 'draft')]

    const primeira = resolvePortalEntry(entrada, CLIENTE)
    const segunda = resolvePortalEntry(entrada, CLIENTE)

    expect(primeira).toEqual(segunda)
  })

  it('preserva a ORDEM recebida — quem ordena e a consulta, com desempate total', () => {
    const resultado = resolvePortalEntry(
      [projeto('primeiro', 'active'), projeto('segundo', 'active')],
      CLIENTE,
    )
    if (resultado.kind !== 'choice') throw new Error('esperava choice')
    expect(resultado.projects.map((p) => p.id)).toEqual(['primeiro', 'segundo'])
  })
})

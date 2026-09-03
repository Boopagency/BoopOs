import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ACTIVITY_ACTION_LABEL, ACTIVITY_ACTIONS } from '@/config/activity'
import { FIELD_MESSAGE, messageFor, WORKFLOW_MESSAGE } from '@/config/messages'
import { CAPABILITIES } from '@/lib/auth/policy'

/**
 * Nenhum código de domínio chega à tela sem tradução.
 *
 * O teste lê o CÓDIGO-FONTE dos workflows e extrai cada `WorkflowError('...')`
 * literal, em vez de repetir uma lista à mão. Uma lista transcrita envelheceria
 * no dia em que alguém acrescentasse um `throw` — que é exatamente o dia em que
 * este teste precisa falhar.
 *
 * A alternativa — exportar os códigos como constante e importá-los — foi
 * descartada: provaria que a constante bate com o mapa, não que o CÓDIGO bate.
 */

/*
 * A lista cresce uma fase por vez, junto com os dominios. A FASE 6 acrescentou
 * `projects/mutations.ts`, e com ele os codigos de projeto e jornada.
 */
const FONTES = [
  '../../src/domains/clients/mutations.ts',
  '../../src/domains/people/mutations.ts',
  '../../src/domains/projects/mutations.ts',
]

function codigosLancados(): string[] {
  const encontrados = new Set<string>()

  for (const relativo of FONTES) {
    const conteudo = readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), 'utf8')
    for (const m of conteudo.matchAll(/new WorkflowError\(\s*'([^']+)'/g)) {
      if (m[1]) encontrados.add(m[1])
    }
  }

  return [...encontrados].sort()
}

describe('WORKFLOW_MESSAGE', () => {
  it('traduz TODO código lançado pelos workflows das FASES 5 e 6', () => {
    const codigos = codigosLancados()

    /* Guarda contra o regex parar de casar e o teste virar tautologia. */
    expect(codigos.length).toBeGreaterThan(10)

    const semTraducao = codigos.filter((c) => !(c in WORKFLOW_MESSAGE))
    expect(semTraducao, `sem mensagem em pt-BR: ${semTraducao.join(', ')}`).toEqual([])
  })

  it('traduz a recusa por papel de toda capacidade das FASES 5 e 6', () => {
    const daFase = [
      'client.create',
      'client.update',
      'client.archive',
      'user.invite',
      'user.disable',
      'membership.grant',
      'membership.revoke',
      /* FASE 6 */
      'project.create',
      'project.update',
      'project.advance_stage',
      'project.change_status',
    ] as const

    for (const capability of daFase) {
      expect(CAPABILITIES).toContain(capability)
      expect(`${capability}.denied` in WORKFLOW_MESSAGE).toBe(true)
    }
  })

  it('traduz os códigos genéricos do próprio defineWorkflow', () => {
    for (const code of [
      'actor.unauthenticated',
      'input.invalid',
      'resource.not_found',
      'workflow.unexpected',
    ]) {
      expect(code in WORKFLOW_MESSAGE).toBe(true)
    }
  })

  it('⚠️ nenhuma mensagem vaza vocabulário técnico', () => {
    /*
     * O que a tela nunca pode dizer: nome de tabela, SQLSTATE, jargão de SQL.
     * "Já existe um cliente com esse identificador" — nunca "unique violation
     * on clients_slug_key" (.claude/rules/security.md).
     */
    const proibido =
      /\b(select|insert|update|delete|constraint|postgres|supabase|rls|policy|null|23505|42501|jwt|token)\b/i

    for (const [code, mensagem] of Object.entries(WORKFLOW_MESSAGE)) {
      expect(proibido.test(mensagem), `${code}: "${mensagem}"`).toBe(false)
    }
  })

  it('⚠️ código desconhecido cai no genérico, nunca ecoa cru na tela', () => {
    const generico = messageFor('codigo.que.ninguem.traduziu')

    expect(generico).not.toContain('codigo.que.ninguem.traduziu')
    expect(messageFor(undefined)).toBe(generico)
    expect(messageFor(null)).toBe(generico)
  })
})

describe('FIELD_MESSAGE', () => {
  it('traduz todo código de erro declarado nos schemas', () => {
    const fontes = ['../../src/domains/clients/schemas.ts', '../../src/domains/people/schemas.ts']
    const codigos = new Set<string>()

    for (const relativo of fontes) {
      const conteudo = readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), 'utf8')
      for (const m of conteudo.matchAll(/error:\s*'([^']+)'/g)) {
        if (m[1]) codigos.add(m[1])
      }
      /* `addIssue` usa `message:`, não `error:`. */
      for (const m of conteudo.matchAll(/message:\s*'([a-z_]+)'/g)) {
        if (m[1]) codigos.add(m[1])
      }
    }

    expect(codigos.size).toBeGreaterThan(8)

    const semTraducao = [...codigos].filter((c) => !(c in FIELD_MESSAGE))
    expect(semTraducao, `sem mensagem de campo: ${semTraducao.join(', ')}`).toEqual([])
  })
})

describe('catálogo do activity log', () => {
  it('toda ação tem rótulo em pt-BR', () => {
    for (const action of ACTIVITY_ACTIONS) {
      expect(ACTIVITY_ACTION_LABEL[action]).toBeTruthy()
    }
  })

  it('⚠️ toda ação respeita o `check` da tabela: dominio.verbo_no_passado', () => {
    /* Mesma regex de `activity_log`: `action ~ '^[a-z_]+\.[a-z_]+$'`. */
    for (const action of ACTIVITY_ACTIONS) {
      expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/)
    }
  })

  it('⚠️ nenhum rótulo expõe o código do evento', () => {
    for (const [action, label] of Object.entries(ACTIVITY_ACTION_LABEL)) {
      expect(label).not.toContain(action)
      expect(label).not.toContain('_')
    }
  })
})

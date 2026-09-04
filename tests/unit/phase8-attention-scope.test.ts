import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_STATUSES, type ProjectStatus } from '@/config/enums'
import type { ProjectPublic } from '@/domains/projects/types'

/*
 * O MOTOR INTEIRO, com as duas fronteiras dubladas.
 *
 * `phase8-attention-source.test.ts` pergunta qual ESTADO vira item.
 * `attention-contract.test.ts` pergunta como itens e falhas viram ESTADO.
 * Aqui a pergunta é outra, e é a única que passa por `getClientAttention()`:
 * quais sources chegam a rodar, e para QUAL projeto o item resultante aponta.
 *
 * As duas coisas que este arquivo prova só existem dentro da porta do motor:
 * o portão de status (D-27) e o escopo por projeto. Nenhum outro teste da fase
 * as afirma — elas viviam só num comentário até aqui.
 *
 * Quem responde "esta linha é desta pessoa?" continua sendo a RLS, contra
 * Postgres de verdade (`tests/rls/phase8-attention-boundaries.test.ts`). O
 * dublê do guard aqui devolve o projeto pedido justamente para provar que, com
 * a autorização já concedida, o motor ainda não mistura um projeto com o outro.
 */

const A = '30000000-0000-4000-8000-00000000000a'
const B = '30000000-0000-4000-8000-00000000000b'

const CLIENTE = '20000000-0000-4000-8000-000000000001'

function projeto(id: string, status: ProjectStatus = 'active'): ProjectPublic {
  return {
    id,
    clientId: CLIENTE,
    name: id === A ? 'Social media' : 'Branding',
    type: 'social',
    status,
    cycle: 1,
    startedOn: null,
  }
}

const banco = vi.hoisted<{ projetos: Map<string, ProjectPublic>; pedidos: string[] }>(() => ({
  projetos: new Map(),
  pedidos: [],
}))

vi.mock('@/domains/projects/queries', () => ({
  requireVisiblePortalProject: (projectId: string) => {
    banco.pedidos.push(projectId)
    const encontrado = banco.projetos.get(projectId)
    if (!encontrado) return Promise.reject(new Error('NEXT_HTTP_ERROR_FALLBACK;404'))
    return Promise.resolve(encontrado)
  },
}))

/*
 * Os dois projetos têm onboarding em `draft`: se o estado fosse o discriminante,
 * os dois produziriam item. O que separa um resultado do outro é só o portão de
 * status e o escopo — que é exatamente o que se quer medir.
 */
vi.mock('@/domains/onboarding/queries', () => ({
  getOnboardingStateForClient: () => Promise.resolve({ state: 'draft' as const }),
}))

const { getClientAttention } = await import('@/domains/attention/queries')

beforeEach(() => {
  banco.projetos = new Map()
  banco.pedidos = []
})

describe('⚠️ só projeto ativo cobra ação de alguém (D-27)', () => {
  it('`active` roda as sources e devolve o que houver', async () => {
    banco.projetos.set(A, projeto(A, 'active'))

    const r = await getClientAttention(A)

    expect(r.state).toBe('attention')
    expect(r.evaluated).toBe(1)
    expect(r.items).toHaveLength(1)
  })

  const PARADOS = PROJECT_STATUSES.filter((s) => s !== 'active')

  it.each(PARADOS)('`%s` não roda source nenhuma', async (status) => {
    banco.projetos.set(A, projeto(A, status))

    const r = await getClientAttention(A)

    expect(r.evaluated).toBe(0)
    expect(r.items).toEqual([])
  })

  it.each(PARADOS)('`%s` é CALMA, nunca degradado', async (status) => {
    banco.projetos.set(A, projeto(A, status))

    const r = await getClientAttention(A)

    /*
     * A distinção que a FASE 8 existe para manter: zero sources relevantes é
     * uma verificação completa que não achou nada, e não uma leitura que
     * falhou. Projeto pausado não é motivo para a Home ficar evasiva.
     */
    expect(r.state).toBe('calm')
    expect(r.complete).toBe(true)
    expect(r.failed).toBe(0)
  })
})

describe('⚠️ o escopo é o projeto pedido, e nenhum outro', () => {
  it('dois projetos do MESMO cliente: só o ativo produz item', async () => {
    banco.projetos.set(A, projeto(A, 'active'))
    banco.projetos.set(B, projeto(B, 'paused'))

    const [rа, rb] = await Promise.all([getClientAttention(A), getClientAttention(B)])

    expect(rа.state).toBe('attention')
    expect(rb.state).toBe('calm')
    expect(rb.items).toEqual([])
  })

  it('todo item aponta para o projeto que foi pedido', async () => {
    banco.projetos.set(A, projeto(A, 'active'))
    banco.projetos.set(B, projeto(B, 'active'))

    for (const id of [A, B]) {
      const r = await getClientAttention(id)

      expect(r.items).toHaveLength(1)
      for (const item of r.items) {
        expect(item.projectId).toBe(id)
        expect(item.cta.href).toContain(`/portal/${id}/`)
        expect(item.id).toContain(id)
      }
    }
  })

  it('⚠️ o item de A nunca aparece no resultado de B', async () => {
    banco.projetos.set(A, projeto(A, 'active'))
    banco.projetos.set(B, projeto(B, 'active'))

    const rа = await getClientAttention(A)
    const rb = await getClientAttention(B)

    const idsDeA = rа.items.map((i) => i.id)
    const idsDeB = rb.items.map((i) => i.id)

    expect(idsDeA.some((id) => idsDeB.includes(id))).toBe(false)
  })
})

describe('a porta consulta o guard antes de qualquer source', () => {
  it('o id que chega ao guard é o id pedido — o motor não escolhe projeto', async () => {
    banco.projetos.set(B, projeto(B, 'active'))

    await getClientAttention(B)

    expect(banco.pedidos).toContain(B)
    expect(banco.pedidos).not.toContain(A)
  })

  it('⚠️ recusa do guard atravessa o motor — 404 não vira estado degradado', async () => {
    /*
     * O projeto não está no mapa: o dublê recusa como `requireVisiblePortalProject`
     * recusa — não existe, não é seu, não está visível, tudo o mesmo 404. Se a
     * porta engolisse esse sinal, um projeto de OUTRO tenant responderia uma
     * Home degradada em vez de 404, e a recusa viraria confirmação de que a
     * linha existe.
     */
    await expect(getClientAttention(A)).rejects.toThrow()
  })
})

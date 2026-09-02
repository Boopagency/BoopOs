import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

/**
 * `defineWorkflow` — o contrato de oito passos de `docs/workflows.md`.
 *
 * Toda escrita do sistema passa por aqui, então um passo que sumisse não
 * quebraria um workflow: quebraria todos, em silêncio. Cada caso abaixo prende
 * um dos passos no lugar.
 *
 * A ordem importa tanto quanto os passos, e há um caso só para ela: validar
 * ANTES de autenticar, autenticar ANTES de autorizar por papel, papel ANTES de
 * escopo. Autorizar antes de validar seria decidir sobre um input que ainda
 * pode ser qualquer coisa.
 */

const getActor = vi.fn()
const logActivity = vi.fn()

vi.mock('@/lib/auth/actor', () => ({
  getActor: () => getActor() as Promise<unknown>,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => Promise.resolve({ marker: 'db-do-ator' }),
}))

vi.mock('@/lib/activity/log', () => ({
  logActivity: (entry: unknown) => logActivity(entry) as Promise<void>,
}))

const { defineWorkflow, scopeAllowed, scopeDenied } = await import('@/lib/workflow/define')
const { WorkflowError } = await import('@/lib/workflow/errors')

const ADMIN = {
  userId: '10000000-0000-4000-8000-000000000001',
  email: 'admin@boop.example.com',
  fullName: 'Marina',
  role: 'boop_admin' as const,
  status: 'active' as const,
}

const CLIENTE = { ...ADMIN, role: 'client_user' as const }

const schema = z.object({ name: z.string().min(2) }).strict()

beforeEach(() => {
  getActor.mockReset()
  logActivity.mockReset()
  getActor.mockResolvedValue(ADMIN)
})

describe('1. validar', () => {
  const wf = defineWorkflow({
    name: 'test.create',
    input: schema,
    capability: 'client.create',
    handler: () => Promise.resolve('ok'),
  })

  it('input válido passa', async () => {
    await expect(wf({ name: 'Hartmann' })).resolves.toEqual({ ok: true, data: 'ok' })
  })

  it('input inválido volta com `input.invalid` e os campos', async () => {
    const r = await wf({ name: 'x' })

    expect(r).toMatchObject({ ok: false, code: 'input.invalid' })
    expect(r.ok === false && r.fieldErrors).toHaveProperty('name')
  })

  it('⚠️ campo desconhecido é REJEITADO, não ignorado', async () => {
    const r = await wf({ name: 'Hartmann', role: 'boop_admin' })
    expect(r).toMatchObject({ ok: false, code: 'input.invalid' })
  })

  it('⚠️ valida ANTES de autenticar: input ruim sem sessão dá `input.invalid`', async () => {
    getActor.mockResolvedValue(null)

    /*
     * A ordem é a do contrato, e não é indiferente: decidir autorização sobre
     * um input que ainda pode ser qualquer coisa é decidir sobre nada.
     */
    const r = await wf({ name: 'x' })
    expect(r).toMatchObject({ code: 'input.invalid' })
  })

  it('⚠️ o VALOR recusado não volta para a tela, só o nome do campo', async () => {
    const r = await wf({ name: 'x' })
    expect(JSON.stringify(r)).not.toContain('"x"')
  })
})

describe('2. autenticar', () => {
  const wf = defineWorkflow({
    name: 'test.create',
    input: schema,
    capability: 'client.create',
    handler: () => Promise.resolve('ok'),
  })

  it('⚠️ sem sessão para em `actor.unauthenticated`', async () => {
    getActor.mockResolvedValue(null)
    await expect(wf({ name: 'Hartmann' })).resolves.toEqual({
      ok: false,
      code: 'actor.unauthenticated',
    })
  })

  it('⚠️ perfil `invited` não escreve nada', async () => {
    getActor.mockResolvedValue({ ...ADMIN, status: 'invited' })
    await expect(wf({ name: 'Hartmann' })).resolves.toMatchObject({
      code: 'actor.unauthenticated',
    })
  })

  it('⚠️ perfil `disabled` não escreve nada', async () => {
    getActor.mockResolvedValue({ ...ADMIN, status: 'disabled' })
    await expect(wf({ name: 'Hartmann' })).resolves.toMatchObject({
      code: 'actor.unauthenticated',
    })
  })
})

describe('3. autorizar por papel', () => {
  const handler = vi.fn(() => Promise.resolve('ok'))

  const wf = defineWorkflow({
    name: 'test.create',
    input: schema,
    capability: 'client.create',
    handler,
  })

  beforeEach(() => handler.mockClear())

  it('⚠️ client_user não cria cliente, e o handler NÃO roda', async () => {
    getActor.mockResolvedValue(CLIENTE)

    const r = await wf({ name: 'Hartmann' })

    expect(r).toEqual({ ok: false, code: 'client.create.denied' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('boop_admin cria cliente', async () => {
    await expect(wf({ name: 'Hartmann' })).resolves.toMatchObject({ ok: true })
  })
})

describe('4. autorizar por escopo', () => {
  const handler = vi.fn(() => Promise.resolve('ok'))

  function comEscopo(decisao: () => ReturnType<typeof scopeAllowed>) {
    return defineWorkflow({
      name: 'test.update',
      input: schema,
      capability: 'client.update',
      authorize: () => Promise.resolve(decisao()),
      handler,
    })
  }

  beforeEach(() => handler.mockClear())

  it('escopo negado devolve 404 genérico e não roda o handler', async () => {
    const r = await comEscopo(() => scopeDenied())({ name: 'Hartmann' })

    /* Inexistente e inalcançável dão o MESMO código (docs/security.md). */
    expect(r).toEqual({ ok: false, code: 'resource.not_found' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('escopo negado pode trazer código próprio quando não revela nada', async () => {
    const r = await comEscopo(() => scopeDenied('client.archived_needs_admin'))({
      name: 'Hartmann',
    })
    expect(r).toMatchObject({ code: 'client.archived_needs_admin' })
  })

  it('escopo permitido segue para o handler', async () => {
    await expect(comEscopo(scopeAllowed)({ name: 'Hartmann' })).resolves.toMatchObject({
      ok: true,
    })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('⚠️ escopo só é consultado DEPOIS do papel: economiza I/O e não vaza existência', async () => {
    getActor.mockResolvedValue(CLIENTE)
    const authorize = vi.fn(() => Promise.resolve(scopeAllowed()))

    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      authorize,
      handler,
    })

    await wf({ name: 'Hartmann' })
    expect(authorize).not.toHaveBeenCalled()
  })
})

describe('5-6. executar e auditar', () => {
  it('o handler recebe o ator, o input validado e o db DO ATOR', async () => {
    type Args = {
      actor: typeof ADMIN
      input: { name: string }
      ctx: { db: { marker: string } }
    }

    let visto: Args | null = null

    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: (args) => {
        visto = args as unknown as Args
        return Promise.resolve('ok')
      },
    })

    await wf({ name: 'Hartmann' })

    expect(visto).not.toBeNull()
    expect(visto!.actor).toEqual(ADMIN)
    expect(visto!.input.name).toBe('Hartmann')
    /* ⚠️ o cliente do ATOR, sob RLS. Nunca `service_role` (ADR-0022). */
    expect(visto!.ctx.db.marker).toBe('db-do-ator')
  })

  it('as linhas de auditoria são gravadas depois do handler', async () => {
    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: ({ ctx }) => {
        ctx.activity({ action: 'client.created', entityType: 'client', entityId: 'abc' })
        return Promise.resolve('ok')
      },
    })

    await wf({ name: 'Hartmann' })

    expect(logActivity).toHaveBeenCalledOnce()
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'client.created' }))
  })

  it('⚠️ handler que falha NÃO grava auditoria: log é do que aconteceu', async () => {
    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: ({ ctx }) => {
        ctx.activity({ action: 'client.created', entityType: 'client' })
        throw new WorkflowError('client.create_failed')
      },
    })

    await expect(wf({ name: 'Hartmann' })).resolves.toMatchObject({
      code: 'client.create_failed',
    })
    expect(logActivity).not.toHaveBeenCalled()
  })
})

describe('7. side-effects', () => {
  it('rodam depois do handler', async () => {
    const ordem: string[] = []

    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: ({ ctx }) => {
        ctx.after(() => {
          ordem.push('after')
          return Promise.resolve()
        })
        ordem.push('handler')
        return Promise.resolve('ok')
      },
    })

    await wf({ name: 'Hartmann' })
    expect(ordem).toEqual(['handler', 'after'])
  })

  it('⚠️ side-effect que falha NÃO derruba a operação que já aconteceu', async () => {
    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: ({ ctx }) => {
        ctx.after(() => Promise.reject(new Error('Resend fora do ar')))
        return Promise.resolve('criado')
      },
    })

    /* A regra de integrações: falha externa nunca derruba domínio. */
    await expect(wf({ name: 'Hartmann' })).resolves.toEqual({ ok: true, data: 'criado' })
  })
})

describe('8. falhar tipado', () => {
  it('WorkflowError vira o código, sem mensagem montada no servidor', async () => {
    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: () => Promise.reject(new WorkflowError('client.slug_taken')),
    })

    await expect(wf({ name: 'Hartmann' })).resolves.toEqual({
      ok: false,
      code: 'client.slug_taken',
    })
  })

  it('⚠️ erro inesperado vira código genérico — nada do provedor chega à tela', async () => {
    const wf = defineWorkflow({
      name: 'test.create',
      input: schema,
      capability: 'client.create',
      handler: () => Promise.reject(new Error('duplicate key value violates unique constraint')),
    })

    const r = await wf({ name: 'Hartmann' })

    expect(r).toEqual({ ok: false, code: 'workflow.unexpected' })
    /* Sem SQL, sem nome de tabela, sem constraint (.claude/rules/security.md). */
    expect(JSON.stringify(r)).not.toContain('constraint')
  })
})

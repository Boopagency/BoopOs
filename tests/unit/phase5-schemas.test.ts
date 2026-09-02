import { describe, expect, it } from 'vitest'
import {
  createClientSchema,
  setClientArchivedSchema,
  setClientStatusSchema,
  updateClientSchema,
} from '@/domains/clients/schemas'
import {
  disableUserSchema,
  grantClientAccessSchema,
  inviteUserSchema,
  revokeClientAccessSchema,
} from '@/domains/people/schemas'

/**
 * Os schemas da FASE 5 — a primeira coisa que roda em toda escrita.
 *
 * Server Action é endpoint público: qualquer um faz POST com qualquer corpo.
 * O que estes casos provam não é que o formulário funciona — é que o que NÃO
 * está no formulário também não entra (.claude/rules/security.md).
 */

const CLIENTE = '20000000-0000-4000-8000-000000000001'
const PESSOA = '10000000-0000-4000-8000-000000000005'

describe('createClientSchema', () => {
  it('aceita o caso feliz e normaliza o slug', () => {
    const r = createClientSchema.safeParse({
      name: '  Hartmann  ',
      slug: '  Hartmann-Advogados  ',
      notes: null,
    })

    expect(r.success).toBe(true)
    expect(r.data?.name).toBe('Hartmann')
    /* `citext` no banco não diferencia caixa; o schema grava a forma canônica. */
    expect(r.data?.slug).toBe('hartmann-advogados')
  })

  it('converte nota vazia em `null` — um estado, não dois', () => {
    const r = createClientSchema.safeParse({ name: 'Hartmann', slug: 'hartmann', notes: '   ' })
    expect(r.data?.notes).toBeNull()
  })

  it('⚠️ REJEITA `id` no payload: a chave primária é do banco', () => {
    const r = createClientSchema.safeParse({
      name: 'Hartmann',
      slug: 'hartmann',
      notes: null,
      id: '20000000-0000-4000-8000-0000000000ff',
    })
    expect(r.success).toBe(false)
  })

  it('⚠️ REJEITA `created_by`: autoria vem do ator, não do corpo', () => {
    const r = createClientSchema.safeParse({
      name: 'Hartmann',
      slug: 'hartmann',
      notes: null,
      created_by: PESSOA,
    })
    expect(r.success).toBe(false)
  })

  it('⚠️ REJEITA `status`: mudar status tem capacidade própria na matriz', () => {
    const r = createClientSchema.safeParse({
      name: 'Hartmann',
      slug: 'hartmann',
      notes: null,
      status: 'archived',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita slug com maiúscula depois da normalização impossível', () => {
    for (const slug of ['com espaço', 'acentuação', '-comeca-com-hifen', 'termina-', 'a--b']) {
      expect(createClientSchema.safeParse({ name: 'X Y', slug, notes: null }).success).toBe(false)
    }
  })

  it('aceita os slugs que o `check` do banco aceita', () => {
    for (const slug of ['hartmann', 'hartmann-advogados', 'marca2', 'a1-b2-c3']) {
      expect(createClientSchema.safeParse({ name: 'X Y', slug, notes: null }).success).toBe(true)
    }
  })
})

describe('updateClientSchema', () => {
  it('aceita nome e nota', () => {
    const r = updateClientSchema.safeParse({
      clientId: CLIENTE,
      name: 'Hartmann & Cia',
      notes: 'contexto',
    })
    expect(r.success).toBe(true)
  })

  it('⚠️ REJEITA `slug`: identificador não muda depois da criação', () => {
    const r = updateClientSchema.safeParse({
      clientId: CLIENTE,
      name: 'Hartmann',
      notes: null,
      slug: 'outro',
    })
    expect(r.success).toBe(false)
  })

  it('⚠️ REJEITA `status`, `created_by` e `updated_at`', () => {
    for (const extra of [
      { status: 'archived' },
      { created_by: PESSOA },
      { updated_at: '2026-01-01' },
    ]) {
      const r = updateClientSchema.safeParse({
        clientId: CLIENTE,
        name: 'Hartmann',
        notes: null,
        ...extra,
      })
      expect(r.success).toBe(false)
    }
  })
})

describe('setClientStatusSchema', () => {
  it('aceita `active` e `paused`', () => {
    for (const status of ['active', 'paused']) {
      expect(setClientStatusSchema.safeParse({ clientId: CLIENTE, status }).success).toBe(true)
    }
  })

  it('⚠️ REJEITA `archived` — senão `client.update` arquivaria sem ser admin', () => {
    /*
     * O caso mais sutil do arquivo. `setClientStatus` roda com a capacidade
     * `client.update`, que `boop_member` tem. Se o schema aceitasse `archived`,
     * um membro arquivaria um cliente contornando `client.archive`, que é só do
     * administrador. A literal fecha isso antes de qualquer autorização.
     */
    expect(setClientStatusSchema.safeParse({ clientId: CLIENTE, status: 'archived' }).success).toBe(
      false,
    )
  })
})

describe('setClientArchivedSchema', () => {
  it('aceita os dois sentidos', () => {
    expect(setClientArchivedSchema.safeParse({ clientId: CLIENTE, archived: true }).success).toBe(
      true,
    )
    expect(setClientArchivedSchema.safeParse({ clientId: CLIENTE, archived: false }).success).toBe(
      true,
    )
  })

  it('rejeita string no lugar do booleano', () => {
    expect(setClientArchivedSchema.safeParse({ clientId: CLIENTE, archived: 'true' }).success).toBe(
      false,
    )
  })
})

describe('inviteUserSchema', () => {
  const base = { email: 'ana@marca.example.com', fullName: 'Ana', role: 'client_user' as const }

  it('aceita client_user com cliente', () => {
    expect(inviteUserSchema.safeParse({ ...base, clientId: CLIENTE }).success).toBe(true)
  })

  it('normaliza o e-mail para minúsculas', () => {
    const r = inviteUserSchema.safeParse({
      ...base,
      email: '  ANA@Marca.Example.COM ',
      clientId: CLIENTE,
    })
    expect(r.data?.email).toBe('ana@marca.example.com')
  })

  it('⚠️ REJEITA `boop_admin` — a matriz não tem essa linha de convite', () => {
    /*
     * `boop_admin` é global por D-08: uma tela que o cria é a escalada mais
     * barata do sistema. Recusado aqui, no workflow, e em
     * `assign_invited_profile_role()` no banco — três vezes.
     */
    const r = inviteUserSchema.safeParse({ ...base, role: 'boop_admin', clientId: CLIENTE })
    expect(r.success).toBe(false)
  })

  it('⚠️ client_user SEM cliente é rejeitado: entraria para ver tela vazia', () => {
    const r = inviteUserSchema.safeParse(base)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['clientId'])
  })

  it('boop_member SEM cliente é aceito: o vínculo vem depois', () => {
    expect(inviteUserSchema.safeParse({ ...base, role: 'boop_member' }).success).toBe(true)
  })

  it('⚠️ REJEITA `userId`: quem é a pessoa é resultado, não entrada', () => {
    const r = inviteUserSchema.safeParse({ ...base, clientId: CLIENTE, userId: PESSOA })
    expect(r.success).toBe(false)
  })

  it('⚠️ REJEITA `status`: ninguém nasce ativo por convite', () => {
    const r = inviteUserSchema.safeParse({ ...base, clientId: CLIENTE, status: 'active' })
    expect(r.success).toBe(false)
  })

  it('rejeita e-mail inválido', () => {
    expect(
      inviteUserSchema.safeParse({ ...base, email: 'sem-arroba', clientId: CLIENTE }).success,
    ).toBe(false)
  })
})

describe('schemas de vínculo e desligamento', () => {
  it('grantClientAccessSchema exige dois uuid e nada mais', () => {
    expect(grantClientAccessSchema.safeParse({ clientId: CLIENTE, userId: PESSOA }).success).toBe(
      true,
    )
    expect(
      grantClientAccessSchema.safeParse({ clientId: CLIENTE, userId: PESSOA, role: 'boop_admin' })
        .success,
    ).toBe(false)
    expect(
      grantClientAccessSchema.safeParse({ clientId: 'nao-e-uuid', userId: PESSOA }).success,
    ).toBe(false)
  })

  it('revokeClientAccessSchema exige o id do vínculo', () => {
    expect(
      revokeClientAccessSchema.safeParse({ membershipId: '21000000-0000-4000-8000-000000000001' })
        .success,
    ).toBe(true)
    expect(revokeClientAccessSchema.safeParse({ clientId: CLIENTE }).success).toBe(false)
  })

  it('disableUserSchema exige o id da pessoa e nada mais', () => {
    expect(disableUserSchema.safeParse({ userId: PESSOA }).success).toBe(true)
    expect(disableUserSchema.safeParse({ userId: PESSOA, status: 'disabled' }).success).toBe(false)
  })
})

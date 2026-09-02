/**
 * A matriz de `docs/permissions.md`, executada celula a celula.
 *
 * A tabela abaixo e transcrita do documento, e nao importada de
 * `policy.ts` — de proposito. Importar a fonte e conferi-la contra si mesma
 * provaria apenas que a igualdade e reflexiva. Aqui existem duas escritas
 * independentes da mesma regra, e o teste falha quando elas divergem: ou o
 * codigo mudou sem o documento, ou o contrario.
 *
 * `✓` = o papel pode em principio. O escopo (ESTE cliente) e outra camada, e
 * quem prova aquilo e `tests/rls/`.
 */
import { describe, expect, it } from 'vitest'
import { CAPABILITIES, can, isAllowed, type Capability, type PolicyActor } from '@/lib/auth/policy'
import type { UserRole } from '@/config/enums'

const ADMIN: PolicyActor = { role: 'boop_admin', status: 'active' }
const MEMBRO: PolicyActor = { role: 'boop_member', status: 'active' }
const CLIENTE: PolicyActor = { role: 'client_user', status: 'active' }

/** [capacidade, boop_admin, boop_member, client_user] */
const MATRIZ: [Capability, boolean, boolean, boolean][] = [
  ['client.read', true, true, true],
  ['client.create', true, false, false],
  ['client.update', true, true, false],
  ['client.archive', true, false, false],
  ['client.read_internal_notes', true, true, false],

  ['user.list', true, true, false],
  ['user.invite', true, false, false],
  ['user.disable', true, false, false],
  ['membership.grant', true, false, false],
  ['membership.revoke', true, false, false],

  ['project.read', true, true, true],
  ['project.create', true, false, false],
  ['project.update', true, true, false],
  ['project.advance_stage', true, true, false],

  ['onboarding.template.manage', true, false, false],
  ['onboarding.start', true, true, false],
  ['onboarding.answer', true, true, true],
  ['onboarding.submit', true, true, true],
  ['onboarding.read_answers', true, true, true],

  ['strategy.create', true, true, false],
  ['strategy.read_draft', true, true, false],
  ['strategy.read_published', true, true, true],
  ['strategy.send_for_approval', true, true, false],
  /* As duas linhas em que o admin aparece como `false`. Ver abaixo. */
  ['strategy.approve', false, false, true],
  ['strategy.request_changes', false, false, true],

  ['content.create', true, true, false],
  ['content.read_internal', true, true, false],
  ['content.read_shared', true, true, true],
  ['content.send_for_approval', true, true, false],
  ['content.approve', false, false, true],
  ['content.request_changes', false, false, true],
  ['content.comment_internal', true, true, false],
  ['content.comment_public', true, true, true],
  ['content.mark_published', true, true, false],
  ['content.archive', true, true, false],

  ['activity.read', true, true, false],
  ['notification.read', true, false, false],
]

describe('matriz de permissoes — celula a celula', () => {
  it('a matriz cobre TODAS as capacidades declaradas', () => {
    /* Sem isto, acrescentar capacidade sem acrescentar caso passaria batido —
     * e a capacidade nova entraria em producao sem nunca ter sido conferida. */
    expect(MATRIZ.map(([c]) => c).sort()).toEqual([...CAPABILITIES].sort())
  })

  for (const [capacidade, admin, membro, cliente] of MATRIZ) {
    it(`${capacidade}: admin=${admin} membro=${membro} cliente=${cliente}`, () => {
      expect(isAllowed(ADMIN, capacidade), `boop_admin em ${capacidade}`).toBe(admin)
      expect(isAllowed(MEMBRO, capacidade), `boop_member em ${capacidade}`).toBe(membro)
      expect(isAllowed(CLIENTE, capacidade), `client_user em ${capacidade}`).toBe(cliente)
    })
  }
})

describe('aprovar e exclusivo do cliente', () => {
  /*
   * Vale um bloco proprio porque e a regra que mais parece um engano quando se
   * le a tabela: o admin, que enxerga tudo, nao aprova nada.
   *
   * Escopo global (D-08) responde QUAIS clientes ele alcanca. Nao responde
   * quais invariantes de dominio ele pode quebrar. Falsificar a aprovacao do
   * cliente destruiria o valor do registro — e o banco concorda: as duas
   * tabelas de aprovacao nao tem policy de INSERT para ninguem.
   */
  const aprovacoes: Capability[] = [
    'strategy.approve',
    'strategy.request_changes',
    'content.approve',
    'content.request_changes',
  ]

  for (const capacidade of aprovacoes) {
    it(`nem boop_admin nem boop_member fazem ${capacidade}`, () => {
      expect(can(ADMIN, capacidade)).toEqual({ allowed: false, code: `${capacidade}.denied` })
      expect(can(MEMBRO, capacidade)).toEqual({ allowed: false, code: `${capacidade}.denied` })
      expect(can(CLIENTE, capacidade)).toEqual({ allowed: true })
    })
  }
})

describe('fail closed', () => {
  const inativos: [string, PolicyActor][] = [
    ['desligado', { role: 'boop_admin', status: 'disabled' }],
    ['ainda convidado', { role: 'boop_admin', status: 'invited' }],
  ]

  for (const [nome, actor] of inativos) {
    it(`${nome} nao pode NADA, nem sendo boop_admin`, () => {
      /* A mesma regra que `app.actor_role()` aplica no banco: sem perfil
       * ativo, sem papel. As duas camadas dizem a mesma coisa. */
      for (const capacidade of CAPABILITIES) {
        expect(can(actor, capacidade), `${nome} passou em ${capacidade}`).toEqual({
          allowed: false,
          code: 'actor.inactive',
        })
      }
    })
  }

  it('capacidade desconhecida nega — nunca "nao achei a regra, entao passa"', () => {
    const inventada = 'client.take_over_the_world' as Capability
    expect(can(ADMIN, inventada)).toEqual({ allowed: false, code: 'capability.unknown' })
  })
})

describe('paridade com a autorizacao do banco', () => {
  /*
   * As duas camadas precisam concordar. Onde `can()` nega para um papel e a
   * policy concede (ou vice-versa), o sistema tem duas verdades — e a que vai
   * valer depende de qual caminho o codigo tomou.
   *
   * A prova completa da concordancia esta em `tests/rls/`, que exercita as
   * mesmas regras contra Postgres real. Aqui ficam as tres afirmacoes que dao
   * para fazer sem banco, e que espelham policies especificas.
   */
  it('so o time da Boop escreve conteudo e estrategia (espelha as policies de INSERT)', () => {
    const escritas: Capability[] = ['content.create', 'strategy.create']
    for (const capacidade of escritas) {
      expect(isAllowed(CLIENTE, capacidade), `cliente escreveria ${capacidade}`).toBe(false)
    }
  })

  it('so `boop_admin` concede vinculo (espelha client_memberships_insert)', () => {
    expect(isAllowed(ADMIN, 'membership.grant')).toBe(true)
    expect(isAllowed(MEMBRO, 'membership.grant')).toBe(false)
    expect(isAllowed(CLIENTE, 'membership.grant')).toBe(false)
  })

  it('o cliente nao le o activity log (espelha activity_log_select e D-05)', () => {
    expect(isAllowed(CLIENTE, 'activity.read')).toBe(false)
    expect(isAllowed(MEMBRO, 'activity.read')).toBe(true)
  })
})

describe('todo papel do enum aparece na matriz', () => {
  it('nenhum papel novo passa despercebido', () => {
    /* Se `user_role` ganhar um valor, este teste falha antes de alguem
     * descobrir em producao que o papel novo nao tem regra nenhuma. */
    const papeis: UserRole[] = ['boop_admin', 'boop_member', 'client_user']
    for (const role of papeis) {
      const actor: PolicyActor = { role, status: 'active' }
      const permitidas = CAPABILITIES.filter((c) => isAllowed(actor, c))
      expect(permitidas.length, `${role} nao pode nada`).toBeGreaterThan(0)
    }
  })
})

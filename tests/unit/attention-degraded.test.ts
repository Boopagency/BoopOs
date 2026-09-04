import { notFound, redirect } from 'next/navigation'
import { describe, expect, it } from 'vitest'
import { runSafely } from '@/domains/attention/safety'
import { resolveAttention } from '@/domains/attention/resolve'
import type { AttentionContext, AttentionSource } from '@/domains/attention/types'
import { item, PROJETO } from '../support/attention-items'

/**
 * Falha de source não pode virar falsa calma — e um 404 não pode virar falha.
 *
 * Estes dois casos são a fase inteira. O primeiro é honestidade com o cliente;
 * o segundo é segurança: engolir o `notFound()` de um projeto de outro tenant
 * transformaria uma recusa de acesso em "não conseguimos verificar", e a página
 * continuaria montando por cima dela.
 */

const ctx = {
  project: {
    id: PROJETO,
    clientId: '20000000-0000-4000-8000-000000000001',
    name: 'Social',
    type: 'social',
    status: 'active',
    cycle: 1,
    startedOn: null,
  },
} as unknown as AttentionContext

function source(run: AttentionSource['run'], key = 'fake'): AttentionSource {
  return { key, appliesTo: () => true, run }
}

describe('uma source que falha é isolada', () => {
  it('source que responde → ok, com os itens', async () => {
    const r = await runSafely(
      source(() => Promise.resolve([item()])),
      ctx,
    )

    expect(r.ok).toBe(true)
    expect(r.ok && r.items).toHaveLength(1)
  })

  it('source que lança erro de leitura → ok:false, sem derrubar a Home', async () => {
    const r = await runSafely(
      source(() => Promise.reject(new Error('onboarding.submission_read_failed'))),
      ctx,
    )

    expect(r.ok).toBe(false)
  })

  it('o outcome de falha NÃO carrega o erro — nada técnico chega à tela', async () => {
    const r = await runSafely(
      source(() => Promise.reject(new Error('permission denied for table onboarding_submissions'))),
      ctx,
    )

    expect(Object.keys(r)).toEqual(['ok'])
    expect(JSON.stringify(r)).not.toMatch(/permission denied|onboarding_submissions/)
  })
})

describe('⚠️ sinais de navegação do Next são RELANÇADOS', () => {
  it('notFound() atravessa o isolamento', async () => {
    /*
     * Se este teste falhar, um projeto de outro tenant deixa de responder 404 e
     * passa a responder "não conseguimos verificar suas pendências" — com a
     * página montando em volta. É falha de segurança com cara de resiliência.
     */
    await expect(
      runSafely(
        source(() => notFound()),
        ctx,
      ),
    ).rejects.toThrow()
  })

  it('redirect() atravessa o isolamento', async () => {
    await expect(
      runSafely(
        source(() => redirect('/login')),
        ctx,
      ),
    ).rejects.toThrow()
  })

  it('o sinal relançado é o do Next, não um erro genérico', async () => {
    const capturado = await runSafely(
      source(() => notFound()),
      ctx,
    ).catch((error: unknown) => error)

    /* O Next identifica os próprios sinais pelo `digest`. */
    expect((capturado as { digest?: string }).digest).toBeTypeOf('string')
  })
})

describe('⚠️ o atalho proibido', () => {
  it('zero itens por FALHA nunca é calma', async () => {
    const outcome = await runSafely(
      source(() => Promise.reject(new Error('qualquer coisa'))),
      ctx,
    )

    const r = resolveAttention([outcome], 1)

    expect(r.state).toBe('degraded')
    expect(r.state).not.toBe('calm')
  })

  it('zero itens por SUCESSO é calma', async () => {
    const outcome = await runSafely(
      source(() => Promise.resolve([])),
      ctx,
    )
    const r = resolveAttention([outcome], 1)

    expect(r.state).toBe('calm')
  })

  it('a diferença entre os dois é invisível em `items` e só existe em `failed`', async () => {
    const falha = resolveAttention(
      [
        await runSafely(
          source(() => Promise.reject(new Error('x'))),
          ctx,
        ),
      ],
      1,
    )
    const vazio = resolveAttention(
      [
        await runSafely(
          source(() => Promise.resolve([])),
          ctx,
        ),
      ],
      1,
    )

    expect(falha.items).toEqual(vazio.items)
    expect(falha.state).not.toBe(vazio.state)
  })
})

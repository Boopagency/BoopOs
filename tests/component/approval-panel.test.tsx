import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApprovalPanel } from '@/components/patterns/approval-panel'
import type { ContentItem } from '@/lib/data/types'

function makeItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'reel-004',
    reference: 'REEL 004',
    title: 'Por que criamos a Hartmann',
    channel: 'instagram',
    format: 'reel',
    status: 'awaiting_client',
    objective: 'Construção de marca',
    territory: 'Universo Hartmann',
    previewTone: 'navy',
    versionCount: 1,
    currentVersion: {
      version: 1,
      hook: 'Gancho',
      caption: 'Legenda',
      cta: 'Chamada',
      createdOn: '2026-08-29',
    },
    comments: [],
    ...overrides,
  }
}

describe('ApprovalPanel', () => {
  it('oferece aprovar e solicitar alteração com a mesma prominência', () => {
    render(<ApprovalPanel item={makeItem()} />)
    const approve = screen.getByRole('button', { name: /aprovar/i })
    const request = screen.getByRole('button', { name: /solicitar alteração/i })

    // Se aprovar fosse mais fácil que pedir ajuste, o produto estaria
    // empurrando o cliente para o "sim". Os dois são botões de mesmo tamanho.
    expect(approve).toBeVisible()
    expect(request).toBeVisible()
    expect(approve.className).toContain('h-14')
    expect(request.className).toContain('h-14')
  })

  it('mostra o momento de marca ao aprovar, não um toast genérico', async () => {
    render(<ApprovalPanel item={makeItem()} />)
    await userEvent.click(screen.getByRole('button', { name: /aprovar/i }))

    expect(screen.getByText(/^aprovado\.$/i)).toBeVisible()
    expect(screen.getByText(/agora é com a gente/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
  })

  it('deixa explícito que nada é registrado no protótipo', () => {
    render(<ApprovalPanel item={makeItem()} />)
    expect(screen.getByText(/nenhuma decisão é registrada/i)).toBeVisible()
  })

  it('não pede decisão de novo numa peça já aprovada', () => {
    render(<ApprovalPanel item={makeItem({ status: 'approved' })} />)
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/já aprovou esta versão/i)).toBeVisible()
  })

  it('explica o estado de uma peça com ajuste pedido', () => {
    render(<ApprovalPanel item={makeItem({ status: 'changes_requested' })} />)
    expect(screen.getByText(/pediu um ajuste/i)).toBeVisible()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusMark } from '@/components/ui/status'
import { CONTENT_STATUSES } from '@/config/enums'

describe('StatusMark', () => {
  it('nunca mostra o valor do enum ao cliente', () => {
    for (const status of CONTENT_STATUSES) {
      const { container, unmount } = render(<StatusMark status={status} />)
      expect(container.textContent).not.toContain(status)
      unmount()
    }
  })

  it('traduz awaiting_client para linguagem de produto', () => {
    render(<StatusMark status="awaiting_client" />)
    expect(screen.getByText('Aguardando você')).toBeVisible()
  })

  it('não depende só de cor: o texto sempre carrega o significado', () => {
    render(<StatusMark status="approved" />)
    expect(screen.getByText('Aprovado')).toBeVisible()
  })
})

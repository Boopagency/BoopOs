import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renderiza como elemento button acessivel por nome', () => {
    render(<Button>Aprovar</Button>)
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
  })

  it('usa type="button" por padrao, para nao submeter formulario sem querer', () => {
    render(<Button>Cancelar</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('nao dispara onClick quando desabilitado', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Aprovar
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('dispara onClick quando habilitado', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Aprovar</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

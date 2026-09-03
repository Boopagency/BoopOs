import { Container } from '@/components/layout/container'
import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <Container>
      <div className="flex items-center gap-3 py-24">
        <Spinner label="Carregando projeto" />
        <p className="t-label text-muted">Carregando projeto…</p>
      </div>
    </Container>
  )
}

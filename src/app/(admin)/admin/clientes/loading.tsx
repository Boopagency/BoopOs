import { Container } from '@/components/layout/container'
import { Spinner } from '@/components/ui/spinner'

/**
 * Estado de carregamento da lista.
 *
 * Um spinner centrado, e nao um esqueleto que imita as linhas: a lista tem
 * altura variavel, e um esqueleto de tamanho errado pisca duas vezes — uma no
 * lugar do conteudo, outra quando o conteudo real reposiciona tudo.
 */
export default function Loading() {
  return (
    <Container>
      <div className="flex items-center gap-3 py-24">
        <Spinner />
        <p className="t-label text-muted">Carregando clientes…</p>
      </div>
    </Container>
  )
}

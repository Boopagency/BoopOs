import { Container } from '@/components/layout/container'
import { ButtonLink } from '@/components/ui/button'

/**
 * A mesma pagina para "nao existe" e para "nao e seu".
 *
 * Mesma decisao da rota de cliente: 403 confirmaria que o projeto existe, e
 * quem troca uuid na URL enumeraria projetos pela diferenca entre as duas
 * respostas (docs/security.md).
 */
export default function ProjectNotFound() {
  return (
    <Container size="narrow">
      <h1 className="t-section text-foreground">Projeto não encontrado</h1>
      <p className="t-body text-muted mt-4 max-w-[46ch]">
        Ou ele não existe, ou não está no seu escopo. Se você esperava encontrá-lo aqui, fale com um
        admin da Boop.
      </p>
      <ButtonLink href="/admin/clientes" variant="outline" className="mt-8">
        Voltar para clientes
      </ButtonLink>
    </Container>
  )
}

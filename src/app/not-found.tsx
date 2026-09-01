import Link from 'next/link'
import { Container } from '@/components/layout/container'

/**
 * 404 unica para toda a aplicacao.
 *
 * Importante para a FASE 4: recurso existente mas inacessivel tambem responde
 * 404, nunca 403 — 403 confirmaria que o recurso existe (docs/security.md).
 * Por isso esta pagina nao diz "pagina nao encontrada" de forma que distinga
 * ausencia de falta de permissao.
 */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col justify-center py-16">
      <Container size="narrow">
        <p className="text-muted text-sm">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Esta pagina nao esta disponivel
        </h1>
        <p className="text-muted mt-4 max-w-prose">
          O endereco pode estar incorreto, ou voce nao tem acesso a este conteudo.
        </p>
        <Link
          href="/"
          className="hover:text-muted mt-8 inline-block text-sm underline underline-offset-4"
        >
          Voltar ao inicio
        </Link>
      </Container>
    </main>
  )
}

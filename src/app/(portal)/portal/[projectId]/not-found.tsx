import Link from 'next/link'
import { EmptyState } from '@/components/patterns/empty-state'

/**
 * 404 dentro do portal.
 *
 * A redacao nao distingue "nao existe" de "voce nao tem acesso": a partir da
 * FASE 4, recurso inacessivel responde 404 justamente para nao confirmar que
 * ele existe (docs/security.md).
 */
export default function PortalNotFound() {
  return (
    <div className="content">
      <EmptyState title="Esta página não está disponível.">
        O endereço pode estar incorreto, ou este conteúdo não faz parte do seu projeto.
      </EmptyState>
      <p className="pb-16 text-center">
        <Link
          href="/portal"
          className="t-meta text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent underline underline-offset-[6px]"
        >
          Voltar ao início
        </Link>
      </p>
    </div>
  )
}

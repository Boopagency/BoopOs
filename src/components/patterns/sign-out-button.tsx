import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/cn'

/**
 * Sair.
 *
 * Server Component com `form action`: funciona antes de o JavaScript carregar
 * e evita o outro caminho — um link GET para /logout, que qualquer
 * `<img src>` de terceiro conseguiria disparar. Sair e mutacao, entao e POST.
 *
 * O `min-h-11` nao e enfeite: medido no cabecalho do portal em 375px, o botao
 * tinha 13.2px de altura — a altura da linha do texto. E o unico controle
 * client-facing que estava abaixo dos 44px, e estava porque os irmaos dele no
 * cabecalho ja carregavam a altura e ele nao (.claude/rules/frontend.md).
 */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          't-meta text-muted hover:text-foreground decoration-rule-strong hover:decoration-accent',
          'flex min-h-11 cursor-pointer items-center',
          'underline underline-offset-[6px] transition-colors',
          className,
        )}
      >
        Sair
      </button>
    </form>
  )
}

import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/cn'

/**
 * Sair.
 *
 * Server Component com `form action`: funciona antes de o JavaScript carregar
 * e evita o outro caminho — um link GET para /logout, que qualquer
 * `<img src>` de terceiro conseguiria disparar. Sair e mutacao, entao e POST.
 */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          't-meta text-muted hover:text-foreground decoration-rule-strong hover:decoration-accent',
          'underline underline-offset-[6px] transition-colors',
          className,
        )}
      >
        Sair
      </button>
    </form>
  )
}

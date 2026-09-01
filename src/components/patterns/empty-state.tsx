import { BoopEyes } from '@/components/brand/boop-eyes'

/**
 * Estado vazio com voz.
 *
 * Nunca "Nenhum dado." — o vazio e um momento de conversa, e e um dos poucos
 * lugares em que o mascote aparece (docs/design-direction.md#mascote).
 */
export function EmptyState({ title, children }: { title: string; children: string }) {
  return (
    <div className="py-16 text-center md:py-24">
      <BoopEyes blink className="mx-auto w-16 opacity-90" />
      <p className="t-title text-foreground mx-auto mt-8 max-w-[20ch]">{title}</p>
      <p className="t-body text-muted mx-auto mt-3 max-w-[38ch]">{children}</p>
    </div>
  )
}

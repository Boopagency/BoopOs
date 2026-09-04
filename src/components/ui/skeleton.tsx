import { cn } from '@/lib/cn'

/**
 * Uma barra de espera com a forma do que vem depois.
 *
 * Não é um card cinza arredondado: é um filete na cor do off-white secundário,
 * com o mesmo raio quase reto do resto do sistema. O esqueleto tem que parecer
 * a página meio impressa, não um componente de biblioteca.
 *
 * `aria-hidden` sempre: quem usa leitor de tela recebe UMA frase — a do
 * `role="status"` de quem compõe — e não a leitura de doze retângulos vazios.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('bg-surface-soft skeleton-pulse block rounded-sm', className)}
    />
  )
}

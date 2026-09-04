/** Primeiro elemento focavel da pagina: pula a navegacao com o teclado. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="bg-accent text-accent-foreground sr-only rounded-sm px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
    >
      Pular para o conteudo
    </a>
  )
}

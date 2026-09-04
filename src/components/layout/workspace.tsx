'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * O eixo que troca, dentro da casca que não troca.
 *
 * ## Por que existe um `key`
 *
 * Sem ele o React reconcilia a mesma `div` entre duas rotas e a animação de
 * entrada nunca reinicia: o conteúdo seria substituído em corte seco, que é
 * exatamente a sensação que a FASE 8.5 existe para tirar. O `key` derivado do
 * caminho força a remontagem do invólucro — e só dele.
 *
 * ## Por que a casca não anima
 *
 * Ela não está aqui dentro. Sidebar, cabeçalho e rodapé são irmãos deste nó,
 * não filhos: não há configuração dizendo "não anime a sidebar", há uma árvore
 * em que a sidebar não participa. É a diferença entre uma regra que alguém
 * pode esquecer e uma que não pode ser violada sem mover código.
 *
 * `usePathname` — e não `useSelectedLayoutSegment` — porque o caminho também
 * muda ao TROCAR DE PROJETO, e trocar de projeto deve reanimar o workspace: é a
 * mudança de contexto mais forte que o portal tem.
 *
 * `children` continua sendo Server Component: ele atravessa como prop
 * serializada pelo RSC e não entra no bundle do cliente. Este arquivo é a única
 * folha cliente que a casca ganhou.
 */
export function Workspace({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="workspace-enter">
      {children}
    </div>
  )
}

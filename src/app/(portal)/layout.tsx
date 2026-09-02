import type { ReactNode } from 'react'
import { requireActor } from '@/lib/auth/actor'

/**
 * Fronteira autenticada do portal.
 *
 * Aqui — e nao no `proxy.ts` — e onde a protecao vale. O proxy renova a
 * sessao e redireciona cedo, mas ja houve classe de bypass de middleware no
 * Next (CVE-2025-29927), e a documentacao do Next 16 avisa que mudar o
 * matcher pode tirar a cobertura do proxy sem ninguem perceber. Este layout
 * roda no servidor de render, sempre, para toda rota do grupo.
 *
 * A casca visual continua em `[projectId]/layout.tsx`: ela depende do
 * projeto, e `/portal` sozinho so redireciona.
 *
 * O que este guard NAO faz: verificar se esta pessoa pode ver ESTE projeto.
 * Isso e `requireProjectAccess()`, que existe desde a FASE 4 e passa a ser
 * chamado quando as telas trocarem os mocks por dado real (FASE 5+). Aqui
 * seria cedo: `/portal` sozinho nao tem projeto, e o layout de
 * `[projectId]` e quem conhece o id.
 */
export default async function PortalGroupLayout({ children }: { children: ReactNode }) {
  await requireActor()

  return children
}

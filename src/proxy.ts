import { NextResponse, type NextRequest } from 'next/server'
import { integrationStatus } from '@/config/env'
import { isProtectedPath, loginPathWithNext } from '@/lib/auth/routes'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Proxy do Next 16 — o antigo `middleware.ts`, renomeado e com a intencao
 * mudada: o time do Next diz para evitar depender dele, e o nome novo
 * ("proxy", camada de rede na frente da aplicacao) descreve melhor o que ele
 * e. Ver ADR-0020 e docs/spec-review.md I-14.
 *
 * ESCOPO, e nada alem disso:
 *   1. renovar o cookie de sessao antes de qualquer render;
 *   2. mandar quem nao tem sessao para /login, guardando o destino.
 *
 * O que NAO acontece aqui: autorizacao multi-tenant, resolucao de vinculo,
 * query de dominio, service role, regra de negocio. Ja houve classe de bypass
 * de middleware no Next (CVE-2025-29927), e a documentacao do proprio Next
 * avisa que uma Server Function e um POST para a rota onde ela vive — mudar o
 * matcher pode tirar a cobertura do proxy sem ninguem perceber. Por isso a
 * protecao real e `requireActor()` no servidor de render, mais a RLS no banco
 * (docs/security.md R-08).
 *
 * Sem Supabase configurado a aplicacao continua subindo: ninguem tem sessao,
 * entao rota protegida manda para /login e o resto segue publico. E o mesmo
 * contrato de `src/config/env.ts` (ADR-0017).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const loginUrl = () => new URL(loginPathWithNext(pathname, search), request.url)

  if (!integrationStatus().supabase) {
    return isProtectedPath(pathname) ? NextResponse.redirect(loginUrl()) : NextResponse.next()
  }

  const { response, userId } = await updateSession(request)

  if (!userId && isProtectedPath(pathname)) {
    const redirect = NextResponse.redirect(loginUrl())

    /*
     * Os cookies vem junto. Quando o refresh token e recusado, o
     * @supabase/ssr limpa a sessao pelo `setAll` — e perder essa limpeza aqui
     * deixaria o cookie invalido no navegador, repetindo o redirect a cada
     * request.
     */
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)

    return redirect
  }

  return response
}

/**
 * Sem matcher o proxy rodaria ate em `_next/static`, e uma regra de auth
 * mal colocada bloquearia CSS e imagem. A lista negativa cobre os assets e
 * deixa passar toda rota de aplicacao — inclusive as publicas, que precisam
 * do refresh de sessao para o cabecalho saber quem esta logado.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|woff|woff2)$).*)',
  ],
}

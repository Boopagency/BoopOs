import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/app/(auth)/login/login-form'
import { BoopMark } from '@/components/brand/boop-mark'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { getActor } from '@/lib/auth/actor'
import { loginErrorFromParam } from '@/lib/auth/errors'
import { AFTER_LOGIN_PATH, safeNextPath } from '@/lib/auth/routes'

export const metadata: Metadata = { title: 'Entrar' }

/*
 * Login — o primeiro contato com a marca.
 *
 * Nao e um card branco no meio da tela. E uma composicao editorial: a laje
 * navy com a promessa em escala de manchete, e o formulario numa coluna de
 * off-white encostada na direita, como a lombada de um impresso.
 *
 * Nao ha senha, e isso e arquitetura, nao economia de tela: a autenticacao do
 * Boop OS e Magic Link (ADR-0009).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>
}) {
  const { next, erro } = await searchParams
  const safeNext = safeNextPath(next)

  /*
   * Quem ja esta dentro nao ve a tela de login. Perfil `disabled` ou
   * `invited` nao entra nesta condicao: para essas pessoas o login e
   * justamente onde a mensagem aparece, e nao um redirect em circulo.
   */
  const actor = await getActor()
  if (actor?.status === 'active') redirect(safeNext ?? AFTER_LOGIN_PATH)

  return (
    <main id="main" className="on-inverse bg-navy relative isolate min-h-dvh overflow-hidden">
      <CloudLayer density="horizon" className="opacity-30 mix-blend-screen" />

      <div className="relative grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
        {/* Editorial */}
        <div className="content flex flex-col justify-between py-10 lg:py-16">
          <BoopMark variant="light" className="h-7 lg:h-8" priority />

          <div className="py-16 lg:py-0">
            <p className="t-meta fade rise-1 text-sky">Boop OS</p>
            <h1 className="t-display rise rise-2 text-cloud mt-6 max-w-[13ch]">
              Entre para ver o que está acontecendo.
            </h1>
            <p className="t-lead rise rise-3 text-muted-on-inverse mt-8 max-w-[42ch]">
              Estratégia, conteúdo, aprovações e resultados da sua marca — em um lugar só,
              atualizados por quem está trabalhando neles.
            </p>
          </div>

          <p className="t-meta text-muted-on-inverse/70 max-lg:hidden">
            Boop · Marca, conteúdo e crescimento
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-background relative flex items-center px-6 py-16 sm:px-10 lg:px-14">
          <LoginForm next={safeNext ?? undefined} initialError={loginErrorFromParam(erro)} />
        </div>
      </div>
    </main>
  )
}

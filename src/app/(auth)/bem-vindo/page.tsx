import type { Metadata } from 'next'
import Link from 'next/link'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { BoopMark } from '@/components/brand/boop-mark'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { portalHref } from '@/config/app'
import { requireActor } from '@/lib/auth/actor'
import { listPortalProjects } from '@/domains/projects/queries'
import { resolvePortalEntry } from '@/domains/projects/visibility'

export const metadata: Metadata = { title: 'Bem-vindas' }

/*
 * Primeiro acesso.
 *
 * É a única tela do produto que existe só para causar impressão — e por isso
 * é a única onde o motion editorial aparece inteiro: manchete, texto e ação
 * entram em sequência (docs/motion.md).
 *
 * Também é o momento em que o mascote se apresenta. Depois daqui ele só
 * reaparece quando tem função: atenção, espera, vazio, aprovação.
 */
export default async function WelcomePage() {
  /* Primeiro acesso e uma tela de dentro do produto: exige sessao. */
  const actor = await requireActor()

  /*
   * A tela mostrava "Hartmann · Social Media" para QUALQUER pessoa que
   * entrasse, porque lia um projeto de mock por uma constante. Agora ela
   * resolve os projetos reais do ator, com a MESMA regra de `/portal`.
   *
   * Com varios projetos ela nao escolhe nenhum: a linha de contexto some e os
   * botoes vao para `/portal`, que e a tela que existe para escolher. Escolher
   * "o primeiro" aqui seria dar a alguem uma boas-vindas ao projeto errado.
   */
  const projects = await listPortalProjects()
  const resolution = resolvePortalEntry(projects, actor)
  const project = resolution.kind === 'single' ? resolution.project : null

  return (
    <main
      id="main"
      className="on-emphasis bg-surface-emphasis relative isolate flex min-h-dvh flex-col overflow-hidden"
    >
      <CloudLayer density="horizon" className="opacity-40" />

      <div className="content relative flex flex-1 flex-col py-10 md:py-14">
        <BoopMark variant="light" className="h-7 md:h-8" priority />

        <div className="flex flex-1 flex-col justify-center py-16">
          <BoopEyes blink className="fade rise-1 w-20 md:w-24" />

          {/* Bloco sem conteudo desaparece: sem projeto resolvido, nao ha
              contexto honesto para mostrar (.claude/rules/frontend.md). */}
          {project && <p className="t-meta rise rise-2 text-navy/70 mt-10">{project.name}</p>}

          <h1 className="t-display rise rise-3 text-cloud mt-5 max-w-[12ch]">Bem-vindas à Boop.</h1>

          <p className="t-lead rise rise-4 text-navy mt-8 max-w-[38ch]">
            Seu projeto começa aqui. Antes de começar a comunicar, precisamos entender — e é por
            isso que a primeira coisa que pedimos é uma conversa, não um briefing.
          </p>

          <div className="rise rise-5 mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href={project ? portalHref(project.id, 'onboarding') : '/portal'}
              className="t-meta bg-navy text-on-inverse hover:bg-navy/90 inline-flex h-14 items-center rounded-sm px-8 transition-colors duration-(--motion-fast) max-sm:w-full max-sm:justify-center"
            >
              Começar
            </Link>
            <Link
              href={project ? portalHref(project.id, '') : '/portal'}
              className="t-meta text-navy decoration-navy/30 hover:decoration-navy underline underline-offset-[6px] transition-colors"
            >
              Ver o projeto primeiro
            </Link>
          </div>
        </div>

        <p className="t-meta text-navy/60">Leva cerca de 15 minutos. Dá para parar e voltar.</p>
      </div>
    </main>
  )
}

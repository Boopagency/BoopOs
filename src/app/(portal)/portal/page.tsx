import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { portalHref } from '@/config/app'
import { requireActor } from '@/lib/auth/actor'
import { listPortalProjects } from '@/domains/projects/queries'
import { resolvePortalEntry } from '@/domains/projects/visibility'
import { formatFullDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Seus projetos' }

/**
 * `/portal` é um RESOLVEDOR, não uma tela.
 *
 * Até a FASE 5 ele redirecionava para uma constante — `DEMO_PROJECT_ID` — e
 * levava todo mundo ao mesmo projeto de mock. Agora ele pergunta ao banco quais
 * projetos este ator alcança (RLS) e quais deles devem aparecer para ele
 * (visibilidade de produto, D-18), e decide:
 *
 *   nenhum   →  estado vazio com voz
 *   um       →  redireciona direto, sem seletor (docs/product.md)
 *   vários   →  mostra a escolha
 *
 * A decisão vive em `resolvePortalEntry()`, que é pura e testada sem Next.
 * Aqui fica só o que é da rota: redirecionar ou renderizar.
 *
 * ## Por que `completed` e `archived` não redirecionam
 *
 * Eles continuam alcançáveis por URL e continuam no histórico do cliente. O que
 * não fazem é participar da escolha automática: mandar alguém direto para um
 * projeto encerrado responderia "onde estamos?" com um projeto do ano passado.
 * Um cliente cujo único projeto terminou vê o estado vazio — que é a verdade.
 */
export default async function PortalIndex() {
  const actor = await requireActor()
  const projects = await listPortalProjects()
  const resolution = resolvePortalEntry(projects, actor)

  if (resolution.kind === 'single') redirect(portalHref(resolution.project.id, ''))

  const isBoop = actor.role !== 'client_user'

  if (resolution.kind === 'empty') {
    return (
      <main id="main" className="content flex min-h-dvh flex-col justify-center py-20">
        <BoopEyes blink className="w-16 opacity-90" />

        <h1 className="t-display text-foreground mt-10 max-w-[14ch]">
          Seu espaço está sendo preparado.
        </h1>

        <p className="t-lead text-muted measure mt-8">
          Seu acesso está certo — é aqui mesmo. A Boop ainda está montando o seu projeto, e ele
          aparece nesta tela assim que estiver pronto. Você não precisa fazer nada até lá.
        </p>

        {/*
          Para quem é da Boop, o vazio tem uma saída: é quase sempre alguém
          conferindo o portal antes de o projeto existir. Para o cliente não há
          CTA nenhum — não há nada que ele possa fazer, e um botão sugeriria
          que há (.claude/rules/frontend.md).
        */}
        {isBoop && (
          <p className="t-meta mt-12">
            <Link
              href="/admin/clientes"
              className="text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent underline underline-offset-[6px]"
            >
              Ir para a administração →
            </Link>
          </p>
        )}
      </main>
    )
  }

  return (
    <main id="main" className="content py-20 md:py-28">
      <h1 className="t-display text-foreground max-w-[14ch]">Seus projetos</h1>

      <p className="t-lead text-muted measure mt-8">
        Você acompanha mais de um projeto com a Boop. Escolha por onde quer começar.
      </p>

      <ul className="divide-rule border-rule mt-14 divide-y border-y">
        {resolution.projects.map((project) => (
          <li key={project.id}>
            <Link
              href={portalHref(project.id, '')}
              className="group flex min-h-[4.5rem] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-6"
            >
              <span className="t-title text-foreground group-hover:text-accent-text transition-colors">
                {project.name}
              </span>
              <span className="t-meta text-muted">
                {project.startedOn
                  ? `desde ${formatFullDate(project.startedOn)}`
                  : `Ciclo ${project.cycle}`}
                {project.status === 'paused' && ' · pausado'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

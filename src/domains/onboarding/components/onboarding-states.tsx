import Link from 'next/link'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { portalHref } from '@/config/app'

/*
 * Os três estados do onboarding que não são formulário.
 *
 * Eles são TRÊS e não um porque descrevem situações diferentes, e a diferença
 * importa para quem lê:
 *
 *   enviado       acabou. É uma confirmação, e ela vem do BANCO — não de um
 *                 `useState` que achou que enviou. Recarregar a página
 *                 continua mostrando isto.
 *   não aberto    vai existir, ainda não. É espera, não erro: nada quebrou, e
 *                 a tela não pode sugerir que quebrou.
 *   indisponível  não vai existir para este projeto. Dizer "ainda não foi
 *                 aberto" aqui seria prometer uma coisa que não vem.
 *
 * Nenhum deles é 404: o projeto existe e é da pessoa. 404 é para quem não
 * deveria estar aqui, e isso o guard do layout já respondeu.
 */

/** Enviado. A mesma abertura editorial do protótipo — agora verdadeira. */
export function OnboardingSubmitted({ projectId }: { projectId: string }) {
  return (
    <div className="on-emphasis bg-surface-emphasis relative isolate min-h-[70vh] overflow-hidden">
      <CloudLayer density="horizon" className="opacity-40" />
      <div className="content relative flex min-h-[70vh] flex-col justify-center py-20">
        <BoopEyes blink className="fade w-20" />
        <h1 className="t-display rise rise-1 text-cloud mt-10 max-w-[13ch]">Recebemos tudo.</h1>
        <p className="t-lead rise rise-2 text-navy mt-8 max-w-[38ch]">
          Agora é com a gente. A equipe lê tudo antes da imersão, e a próxima etapa do projeto já
          está aberta.
        </p>
        <div className="rise rise-3 mt-12">
          <Link
            href={portalHref(projectId, '')}
            className="t-meta bg-navy text-on-inverse hover:bg-navy/90 inline-flex h-14 items-center rounded-sm px-8 transition-colors max-sm:w-full max-sm:justify-center"
          >
            Ver o projeto
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Aberto ainda não.
 *
 * Estado vazio nunca diz "nenhum dado": diz o que está acontecendo e o que vem
 * a seguir, na voz da Boop (.claude/rules/frontend.md).
 */
export function OnboardingNotStarted({ projectId }: { projectId: string }) {
  return (
    <div className="content py-16 md:py-24">
      <h1 className="t-section measure text-foreground">Seu onboarding ainda não foi aberto.</h1>
      <p className="t-body text-muted mt-6 max-w-[52ch]">
        A equipe está preparando as perguntas do seu projeto. Quando estiver tudo pronto, você
        responde por aqui — no computador ou no celular, com calma, e sem precisar terminar de uma
        vez.
      </p>
      <div className="mt-10">
        <Link
          href={portalHref(projectId, '')}
          className="t-meta text-accent-text hover:text-navy inline-flex h-11 items-center transition-colors"
        >
          Voltar para o projeto →
        </Link>
      </div>
    </div>
  )
}

/** Este projeto não tem onboarding. Nem vai ter — e a frase diz isso. */
export function OnboardingUnsupported({ projectId }: { projectId: string }) {
  return (
    <div className="content py-16 md:py-24">
      <h1 className="t-section measure text-foreground">
        Este projeto não tem formulário de onboarding.
      </h1>
      <p className="t-body text-muted mt-6 max-w-[52ch]">
        O que a equipe precisa saber vai ser combinado direto com você, nas conversas do projeto.
        Acompanhe o andamento pela jornada.
      </p>
      <div className="mt-10">
        <Link
          href={portalHref(projectId, '')}
          className="t-meta text-accent-text hover:text-navy inline-flex h-11 items-center transition-colors"
        >
          Voltar para o projeto →
        </Link>
      </div>
    </div>
  )
}

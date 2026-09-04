import { Skeleton } from '@/components/ui/skeleton'

/**
 * A espera com a FORMA da página, e não um spinner no meio do nada.
 *
 * ## O que estava errado
 *
 * Até a FASE 8.5 este arquivo era um `Spinner` centralizado dentro de
 * `min-h-[50vh]`. O efeito era o pior dos dois mundos: o conteúdo sumia, a
 * altura do documento mudava, o scroll pulava, e um instante depois tudo voltava
 * numa altura diferente. Uma espera que causa layout shift é pior que espera
 * nenhuma.
 *
 * ## O que ele faz agora
 *
 * Desenha as três faixas que TODA rota do portal tem: uma abertura curta, uma
 * laje larga e uma seção de texto. As proporções são as reais — a laje de
 * atenção é a região alta da Home — então a página troca de esqueleto para
 * conteúdo sem a régua se mexer.
 *
 * A casca não entra aqui: sidebar, cabeçalho e navegação ficam de pé e
 * interativos, porque o `loading.tsx` substitui só o `children` do layout.
 *
 * ## Uma frase, não doze retângulos
 *
 * Cada `Skeleton` é `aria-hidden`. O anúncio é o `role="status"` abaixo, uma vez
 * só. E não há atraso artificial em lugar nenhum: isto aparece enquanto o dado
 * realmente não chegou (docs/motion.md).
 */
export default function PortalLoading() {
  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        Carregando o projeto
      </p>

      {/* Abertura: saudação e metadado. */}
      <div className="content py-8 md:py-14">
        <Skeleton className="h-8 w-[min(22ch,100%)] md:h-9" />
        <Skeleton className="mt-4 h-3 w-[min(28ch,100%)]" />
      </div>

      {/* A laje — a região mais alta da Home, e a que mais custa se mexer. */}
      <div className="bg-surface-soft/60 border-rule border-y">
        <div className="content py-12 md:py-20">
          <Skeleton className="bg-bone h-3 w-40" />
          <div className="mt-8 flex items-start gap-5 md:gap-7">
            <Skeleton className="bg-bone h-14 w-14 shrink-0 md:h-20 md:w-20" />
            <div className="w-full">
              <Skeleton className="bg-bone h-14 w-24 md:h-20 md:w-32" />
              <Skeleton className="bg-bone mt-4 h-5 w-[min(19ch,100%)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Seção de texto: título e apoio. */}
      <div className="content py-12 md:py-16">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-[min(18ch,100%)] md:h-12" />
        <Skeleton className="mt-5 h-4 w-[min(48ch,100%)]" />
      </div>
    </div>
  )
}

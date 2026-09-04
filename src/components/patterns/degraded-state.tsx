import { BoopEyes } from '@/components/brand/boop-eyes'

/**
 * "Não conseguimos verificar todas as suas pendências agora."
 *
 * O estado que impede a mentira mais fácil do produto.
 *
 * Uma source que falha devolve zero itens — exatamente como uma source que
 * respondeu e não achou nada. Se o produto tratasse os dois casos igual, uma
 * falha de leitura viraria "tudo certo por aqui", e o cliente sairia do portal
 * achando que nada depende dele com uma pendência aberta que ninguém conseguiu
 * ler. Zero itens porque a leitura falhou não é zero pendências.
 *
 * ## O tom é neutro, e isso é decisão
 *
 * Sem `role="alert"`, sem ícone de erro, sem cor de perigo, sem botão de
 * "tentar de novo" — o cliente não causou nada e não tem o que consertar. A
 * recarga normal da página é o retry, e a frase seguinte diz que o resto da
 * Home continua valendo.
 *
 * ## O que nunca aparece aqui
 *
 * Stack, SQL, nome de tabela, código do Postgres, digest, valor de env. O
 * motivo da falha vai para o log com a chave da source e nada mais; o
 * componente recebe números, nunca erros.
 */
export function DegradedState() {
  return (
    <section aria-labelledby="nao-verificado" className="bg-surface-soft/60 border-rule border-y">
      <div className="content flex items-start gap-5 py-12 md:gap-8 md:py-16">
        <BoopEyes className="w-12 shrink-0 opacity-70 md:w-16" />

        <div className="min-w-0">
          <h2 id="nao-verificado" className="t-section text-foreground max-w-[20ch]">
            Não conseguimos verificar todas as suas pendências agora.
          </h2>
          <p className="t-lead text-muted mt-4 max-w-[36ch]">
            Você ainda pode acompanhar o andamento do projeto abaixo.
          </p>
        </div>
      </div>
    </section>
  )
}

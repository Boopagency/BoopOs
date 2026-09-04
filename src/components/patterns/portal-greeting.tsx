import { firstName, greeting } from '@/lib/format'

/**
 * A abertura da Home: curta, e para a PESSOA.
 *
 * ## O que ela substituiu
 *
 * O `DashboardHero` era uma laje de cor cheia com nuvens e um `t-display` de
 * duas linhas, e cumprimentava a MARCA — "Boa tarde, Hartmann." Cumprimentar
 * uma empresa como se fosse gente é o gesto que faz um portal parecer um CRM, e
 * `actor.fullName` existe desde a FASE 3 sem nunca ter sido usado aqui.
 *
 * A laje também custava caro: em 375 × 667 ela consumia a primeira tela inteira,
 * e o cliente precisava rolar para descobrir se alguma coisa dependia dele —
 * exatamente a pergunta que ele abriu o portal para responder em três segundos.
 * A laje de cor cheia migrou para onde ela significa alguma coisa: o bloco de
 * atenção.
 *
 * ## Sem nome, cumprimenta sem nome
 *
 * `full_name` é nullable: uma pessoa convidada que nunca preencheu o cadastro
 * não tem nome. Nesse caso a saudação fica "Boa tarde." e ponto. **Nunca** cai
 * para o nome do cliente (D-28).
 */
export function PortalGreeting({
  fullName,
  clientName,
  projectName,
}: {
  fullName: string | null
  clientName: string
  projectName: string
}) {
  const nome = firstName(fullName)

  return (
    <section className="content py-10 md:py-14">
      <h1 className="t-title text-foreground max-w-[18ch]">
        {nome ? `${greeting()}, ${nome}.` : `${greeting()}.`}
      </h1>

      {/*
        O contexto vem SEPARADO da saudação, e em escala de metadado: quem é o
        cliente e qual é o projeto é moldura, não é a frase.
      */}
      <p className="t-meta text-muted mt-3">
        {clientName} · {projectName}
      </p>
    </section>
  )
}

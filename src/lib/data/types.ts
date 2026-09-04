/**
 * Formas de APRESENTAÇÃO do portal.
 *
 * O que sobrou aqui depois da FASE 8 são os dois tipos que descrevem o que um
 * COMPONENTE precisa receber — nada mais. Eles não são entidades de domínio,
 * não são projeções de banco e não têm loader: as entidades vivem em
 * `src/domains/<dominio>/types.ts`, cada uma com a própria fronteira de autorização.
 *
 * ## O que este arquivo era, e por que encolheu tanto
 *
 * Ele nasceu na FASE 1 como o contrato do meio de `MOCK → DATA LAYER →
 * SUPABASE`, com treze interfaces: conteúdo, estratégia, resultados, arquivos,
 * reuniões, entrega, atenção. Cada fase que ligou dado real levou a sua embora
 * — projetos na FASE 6, onboarding na FASE 7, atenção nesta.
 *
 * As que sumiram sem substituto (`ContentItem`, `Strategy`, `ResultsPeriod`,
 * `ProjectFile`, `Meeting`, `Delivery`) descreviam o PROTÓTIPO, não o banco:
 * `previewTone`, `sizeLabel`, `versionCount` não são colunas de lugar nenhum.
 * Guardá-las como referência garantiria que a FASE 9 ou 10 tentasse encaixar o
 * schema real numa forma inventada — foi exatamente o que a FASE 7 evitou ao
 * descartar `OnboardingSection` do protótipo e reescrevê-la a partir das colunas.
 *
 * `src/lib/data/portal.ts` foi embora junto: ele existia para segurar mock, e
 * manter a camada depois que o mock morre é deixar a próxima ficção com um
 * lugar pronto para nascer.
 */
import type { StageState } from '@/config/enums'

/**
 * Uma etapa, como o `ProjectJourney` precisa dela.
 *
 * Estruturalmente compatível com `ProjectStage` do domínio, que é quem a
 * preenche de verdade — a página passa as linhas do banco direto.
 */
export interface JourneyStage {
  key: string
  label: string
  state: StageState
  /**
   * Uma linha explicando o que acontece nesta etapa. Visível ao cliente.
   *
   * `null` quando a `stage_key` do projeto não existe mais no template — um
   * projeto criado com uma jornada depois aposentada. A etapa continua com
   * rótulo, posição e estado, que vêm do banco; some só o texto de apoio.
   */
  summary: string | null
  completedOn?: string | null
}

/**
 * Uma leitura com autoria: o diferencial declarado da Boop.
 *
 * Nenhuma tela a renderiza hoje — a origem é `monthly_reviews` e as tabelas de
 * métrica, que chegam nas FASES 14 e 15. O `InsightBlock` fica no repositório
 * porque é composição visual pura, sem forma de domínio inventada: quando
 * houver leitura de verdade, ele a recebe como está.
 */
export interface Insight {
  id: string
  headline: string
  detail: string
  /** De onde veio a leitura. Dá credibilidade ao insight. */
  evidence?: string
}

/**
 * A convenção de projeção — a resposta à dívida column-level da FASE 4.
 *
 * ## O problema, em uma frase
 *
 * RLS é row-level. Quando a policy concede a linha, ela concede a linha
 * inteira — e `clients.notes` é bastidor da Boop viajando de carona na mesma
 * linha que o cliente precisa ler. GRANT de coluna não separa as personas
 * porque `authenticated` é **um papel só** para as três
 * (docs/security.md#o-que-a-rls-não-faz-coluna).
 *
 * A FASE 4 registrou isso como dívida datada, com o prazo nesta fase, porque
 * enquanto o portal lia mocks não existia caminho que expusesse a coluna.
 * Ligar o dado real abriu esse caminho. Este arquivo o fecha.
 *
 * ## A proteção, em três camadas
 *
 * 1. **A coluna não sai do banco.** Toda leitura declara suas colunas por
 *    extenso — `select *` é proibido pela regra do repositório —, e a lista
 *    client-facing simplesmente não contém o campo interno. O dado protegido
 *    é o que nunca foi buscado.
 *
 * 2. **O tipo não tem o campo.** `AssertClientFacing<T>` abaixo faz o
 *    `tsc --noEmit` falhar se uma projeção client-facing ganhar um campo
 *    interno. Não é convenção que alguém precisa lembrar em revisão: é o
 *    portão da DoD quebrando.
 *
 * 3. **O teste prova as duas.** `tests/unit/projection.test.ts` confere as
 *    listas de colunas; `tests/rls/internal-visibility.test.ts` confere o que
 *    o banco devolve para cada papel.
 *
 * ## Por que não uma view no banco
 *
 * Uma view client-facing resolveria por outro caminho, e foi descartada: ela
 * traz `security_invoker`, GRANTs próprios, comportamento próprio no PostgREST
 * e um segundo lugar onde a verdade sobre colunas mora. Uma projeção explícita
 * do lado do servidor resolve o mesmo com menos peças móveis, e é conferível
 * lendo uma linha (CLAUDE.md — diante de duas soluções válidas, a mais simples).
 *
 * ## Como estender
 *
 * Campo interno novo entra em `INTERNAL_FIELDS`. A partir daí, toda projeção
 * client-facing que o carregue para de compilar — inclusive as que já existem.
 * É de propósito: a lista é a definição de "interno" do sistema inteiro, e não
 * pode ser contornada esquecendo de olhar para ela.
 */

/**
 * Nomes de coluna que **nunca** podem alcançar um `client_user`.
 *
 * A lista é por NOME, e não por tabela, de propósito. Um nome de coluna
 * interno em uma tabela é interno em qualquer tabela: `notes` e
 * `internal_notes` querem dizer a mesma coisa onde quer que apareçam, e uma
 * lista por tabela precisaria de manutenção em dois lugares para proteger o
 * mesmo conceito.
 *
 * - `notes`           — `clients.notes`, nota interna da Boop sobre a conta.
 * - `internal_notes`  — `content_versions.internal_notes`. **Nenhuma query
 *                       desta fase toca conteúdo** (FASE 10), e o nome já está
 *                       aqui de propósito: quando a FASE 10 escrever a primeira
 *                       leitura client-facing de versão, a regra já vale e o
 *                       compilador já cobra.
 */
export const INTERNAL_FIELDS = ['notes', 'internal_notes'] as const

export type InternalField = (typeof INTERNAL_FIELDS)[number]

/** Os campos internos que um tipo carrega. Vazio quando ele é seguro. */
export type InternalFieldsIn<T> = Extract<keyof T, InternalField>

/**
 * A restrição: `unknown` (que tudo satisfaz) quando o tipo é limpo, e um objeto
 * impossível quando não é.
 *
 * O braço falso podia ser `never`, e não é de propósito: com `never`, o erro do
 * compilador diz apenas "não satisfaz a restrição 'never'", e quem o lê precisa
 * adivinhar o motivo. Com um objeto nomeado, o erro cita o nome da regra **e**
 * o campo que a violou:
 *
 *     Type 'ClientPublic' does not satisfy the constraint
 *     '{ CAMPO_INTERNO_EM_PROJECAO_CLIENT_FACING: "notes" }'
 *
 * A mensagem é a documentação que a pessoa vai ler no pior momento possível.
 */
type NoInternalFields<T> = [InternalFieldsIn<T>] extends [never]
  ? unknown
  : { CAMPO_INTERNO_EM_PROJECAO_CLIENT_FACING: InternalFieldsIn<T> }

/**
 * Marca um tipo como seguro para sair do servidor rumo a um `client_user`.
 *
 * Usar ao lado da definição, exportando o alias — exportado porque
 * `noUnusedLocals` derruba um tipo local que ninguém lê, e a graça aqui é
 * justamente ninguém precisar lê-lo:
 *
 * ```ts
 * export interface ClientPublic { id: string; name: string }
 * export type _ClientPublicIsSafe = AssertClientFacing<ClientPublic>
 * ```
 *
 * Acrescente `notes: string | null` a `ClientPublic` e o `pnpm typecheck` falha
 * na linha do assert. Não é revisão de código: é o portão da DoD.
 */
export type AssertClientFacing<T extends NoInternalFields<T>> = T

/**
 * Confere em tempo de execução que um objeto não carrega campo interno.
 *
 * A checagem de tipo cobre o que está escrito no código; esta cobre o que
 * chegou do banco — uma projeção montada por concatenação, um `select` que
 * alguém ampliou, um dado que passou por `JSON.parse`. É barata e roda só nos
 * testes e no caminho de desenvolvimento.
 *
 * Devolve os campos encontrados em vez de lançar: quem chama decide se aquilo
 * é um erro de teste ou um log.
 */
export function findInternalFields(value: unknown): InternalField[] {
  if (value === null || typeof value !== 'object') return []

  const found = new Set<InternalField>()

  const visit = (node: unknown, depth: number): void => {
    /* Profundidade limitada: read model não é árvore, e um ciclo pararia aqui. */
    if (depth > 6 || node === null || typeof node !== 'object') return

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }

    for (const [key, child] of Object.entries(node)) {
      if ((INTERNAL_FIELDS as readonly string[]).includes(key)) {
        found.add(key as InternalField)
      }
      visit(child, depth + 1)
    }
  }

  visit(value, 0)

  return [...found]
}

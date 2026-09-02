/**
 * O formato do retorno de uma Server Action.
 *
 * Mora fora de `actions.ts` por uma restricao real do Next: um arquivo
 * `'use server'` so pode exportar funcoes async — exportar o objeto `IDLE` dali
 * derruba o build com "a 'use server' file can only export async functions".
 * Faz sentido: tudo o que aquele arquivo exporta vira endpoint, e um objeto
 * nao e chamavel.
 *
 * Tambem nao leva `server-only`: quem consome este tipo e o Client Component
 * que chama `useActionState`.
 *
 * `WorkflowResult` (em `define.ts`) e o resultado do DOMINIO; `ActionState` e o
 * estado da TELA. Sao parecidos e nao sao o mesmo: a action traduz um no outro,
 * acrescentando a mensagem de sucesso que so a tela conhece.
 */
export type ActionState = {
  status: 'idle' | 'error' | 'success'
  /** Codigo de dominio. A traducao para pt-BR e da UI (`config/messages.ts`). */
  code?: string
  /** Erros por campo, do zod. Chave = caminho do campo, valor = codigos. */
  fieldErrors?: Record<string, string[]>
  /** Frase de sucesso, ja em pt-BR: e a tela que sabe o que acabou de mudar. */
  message?: string
}

export const IDLE: ActionState = { status: 'idle' }

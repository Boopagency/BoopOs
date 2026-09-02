/**
 * Rotas de autenticacao e as regras puras que decidem o que e publico.
 *
 * Sao funcoes puras de proposito: o `proxy.ts` precisa delas, e o proxy do
 * Next 16 nao deve depender de estado compartilhado. Puro tambem quer dizer
 * testavel sem banco, sem sessao e sem Next — e `safeNextPath` e uma barreira
 * de seguranca (open redirect), entao ela precisa de teste.
 */

export const LOGIN_PATH = '/login'
export const AUTH_CALLBACK_PATH = '/auth/callback'

/**
 * Para onde o login leva quando nao ha destino pedido. `/portal` resolve o
 * projeto sozinho — hoje pelo mock, na FASE 6 pela lista real do usuario.
 */
export const AFTER_LOGIN_PATH = '/portal'

/**
 * Onde o destino pedido espera enquanto a pessoa vai ao e-mail.
 *
 * Ele NAO viaja na URL do Magic Link, e a razao e dupla. A primeira e
 * operacional: `emailRedirectTo` e conferido contra a lista de Redirect URLs
 * do Supabase, e acrescentar query string obrigaria a cadastrar curinga —
 * que aceitaria como destino de sessao qualquer URL que casasse com o padrao.
 * A segunda e de seguranca: no cookie, o destino pertence ao navegador que
 * pediu o link, e nao a quem abrir o e-mail.
 *
 * O TTL acompanha o do proprio link (15 min): sobreviver a ele so deixaria
 * lixo no navegador.
 */
export const NEXT_COOKIE = 'boop-auth-next'
export const NEXT_COOKIE_MAX_AGE = 900

/**
 * Prefixos que exigem sessao. Lista explicita, e nao "tudo menos /login":
 * uma rota publica nova (marketing, health check) nao pode passar a exigir
 * sessao por acidente, e uma rota privada nova aparece aqui de proposito.
 *
 * `/` continua publico: e o indice do prototipo (FASE 1), que some quando o
 * portal real ocupar a raiz.
 */
const PROTECTED_PREFIXES = ['/portal', '/admin', '/bem-vindo'] as const

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/** Byte de controle em URL nunca e legitimo aqui: serve para enganar parser. */
function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Valida o `?next=` antes de redirecionar para ele.
 *
 * Um `next` que o atacante escolhe e um open redirect: `/login?next=https://
 * evil.example` faria o proprio produto entregar a pessoa autenticada em
 * outro dominio. So caminho interno passa, e o teste cobre cada forma de
 * escapar: URL absoluta, `//host` (protocol-relative), `/\host` (que alguns
 * navegadores normalizam para `//host`) e caractere de controle.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (hasControlCharacter(value)) return null

  /* Voltar para o proprio callback so gastaria o link de novo, sem code. */
  if (value === AUTH_CALLBACK_PATH || value.startsWith(`${AUTH_CALLBACK_PATH}?`)) return null
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return null

  return value
}

/**
 * O `/login` que preserva para onde a pessoa estava indo. Sem isso, quem
 * recebe um link direto de conteudo cai no portal generico depois de entrar.
 */
export function loginPathWithNext(pathname: string, search = ''): string {
  const next = safeNextPath(`${pathname}${search}`)
  return next ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}` : LOGIN_PATH
}

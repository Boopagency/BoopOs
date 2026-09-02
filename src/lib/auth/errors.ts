/**
 * Traducao dos erros de autenticacao.
 *
 * Duas regras governam este arquivo:
 *
 *   1. O dominio devolve `code`; a UI traduz para pt-BR (.claude/rules/frontend.md).
 *      Por isso o mapa de mensagens mora aqui e nao no componente: a mesma
 *      falha precisa dizer a mesma coisa no formulario e no callback.
 *
 *   2. Erro nunca conta o que o atacante quer saber (docs/security.md). O
 *      disparo do link e o caso critico: se "e-mail nao cadastrado" chegasse
 *      a tela, o formulario de login viraria um oraculo de quem e cliente da
 *      Boop. Por isso `sendErrorCode` devolve `null` — silencio deliberado —
 *      para toda familia de erro que revelaria a existencia da conta.
 */

export type LoginErrorCode =
  | 'invalid_email'
  | 'rate_limited'
  | 'link_expired'
  | 'link_invalid'
  | 'access_revoked'
  | 'activation_pending'
  | 'unavailable'

export const LOGIN_ERROR_MESSAGE: Record<LoginErrorCode, string> = {
  invalid_email: 'Confira o e-mail: parece que falta alguma coisa.',
  rate_limited: 'Muitas tentativas em pouco tempo. Espere alguns minutos e peça de novo.',
  link_expired: 'Esse link expirou. Peça um novo — ele vale por 15 minutos.',
  link_invalid: 'Esse link não funciona mais. Peça um novo para entrar.',
  access_revoked: 'Seu acesso está suspenso. Fale com a pessoa que cuida do seu projeto.',
  activation_pending: 'Não conseguimos concluir seu acesso. Peça um novo link para entrar.',
  unavailable: 'Não conseguimos enviar agora. Tente de novo em instantes.',
}

/**
 * Familias de erro do disparo que NAO podem chegar a tela: todas respondem
 * "essa conta nao existe / nao pode receber link", que e exatamente a
 * pergunta que o formulario nao pode responder. A pessoa ve a mesma tela de
 * "link enviado" que veria se o e-mail existisse.
 */
const SILENT_ON_SEND = new Set([
  'otp_disabled',
  'signup_disabled',
  'user_not_found',
  'email_address_not_authorized',
  'validation_failed',
])

const RATE_LIMITED = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
])

/**
 * Erro do `signInWithOtp`. `null` significa: nao mostre nada de diferente —
 * a tela de confirmacao e a resposta, exista a conta ou nao.
 */
export function sendErrorCode(code: string | undefined, status?: number): LoginErrorCode | null {
  if (code && SILENT_ON_SEND.has(code)) return null
  if (code && RATE_LIMITED.has(code)) return 'rate_limited'
  /* Sem `code` legivel, o 429 ainda e reconhecivel pelo status. */
  if (status === 429) return 'rate_limited'
  if (code === 'user_banned') return null
  if (code === 'email_address_invalid') return 'invalid_email'
  return 'unavailable'
}

const EXPIRED = new Set(['otp_expired', 'flow_state_expired'])
const INVALID = new Set([
  'flow_state_not_found',
  'bad_code_verifier',
  'bad_oauth_state',
  'validation_failed',
])

/**
 * Erro do callback. Aqui a pessoa ja clicou no link: dizer que ele expirou
 * nao revela nada que ela nao saiba, e sem isso ela nao entende por que
 * voltou para o login.
 */
export function callbackErrorCode(code: string | undefined): LoginErrorCode {
  if (code && EXPIRED.has(code)) return 'link_expired'
  if (code && INVALID.has(code)) return 'link_invalid'
  if (code === 'user_banned') return 'access_revoked'
  return 'link_invalid'
}

/** Le o `?erro=` da URL. Valor desconhecido vira `null`, nunca eco na tela. */
export function loginErrorFromParam(value: string | undefined): LoginErrorCode | null {
  if (!value) return null
  return value in LOGIN_ERROR_MESSAGE ? (value as LoginErrorCode) : null
}

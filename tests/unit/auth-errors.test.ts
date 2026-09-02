import { describe, expect, it } from 'vitest'
import {
  LOGIN_ERROR_MESSAGE,
  callbackErrorCode,
  loginErrorFromParam,
  sendErrorCode,
} from '@/lib/auth/errors'

describe('sendErrorCode — protecao de enumeracao', () => {
  /*
   * O caso que justifica o arquivo: se qualquer um destes virasse mensagem na
   * tela, o formulario de login responderia "esse e-mail e cliente da Boop"
   * para quem perguntasse (docs/security.md).
   */
  it.each(['otp_disabled', 'signup_disabled', 'user_not_found', 'email_address_not_authorized'])(
    'silencia %s',
    (code) => {
      expect(sendErrorCode(code)).toBeNull()
    },
  )

  it('silencia usuario banido — quem esta fora nao descobre isso pelo login', () => {
    expect(sendErrorCode('user_banned')).toBeNull()
  })

  it('mostra excesso de tentativas, por codigo ou por status', () => {
    expect(sendErrorCode('over_email_send_rate_limit')).toBe('rate_limited')
    expect(sendErrorCode(undefined, 429)).toBe('rate_limited')
  })

  it('mostra e-mail invalido', () => {
    expect(sendErrorCode('email_address_invalid')).toBe('invalid_email')
  })

  it('trata desconhecido como indisponibilidade, nunca como sucesso', () => {
    expect(sendErrorCode('algo_que_nao_conhecemos')).toBe('unavailable')
    expect(sendErrorCode(undefined)).toBe('unavailable')
  })
})

describe('callbackErrorCode', () => {
  it('distingue link expirado de link invalido', () => {
    expect(callbackErrorCode('otp_expired')).toBe('link_expired')
    expect(callbackErrorCode('flow_state_expired')).toBe('link_expired')
    expect(callbackErrorCode('bad_code_verifier')).toBe('link_invalid')
    expect(callbackErrorCode('flow_state_not_found')).toBe('link_invalid')
  })

  it('reconhece acesso revogado', () => {
    expect(callbackErrorCode('user_banned')).toBe('access_revoked')
  })

  it('cai em link invalido quando nao reconhece', () => {
    expect(callbackErrorCode(undefined)).toBe('link_invalid')
  })
})

describe('loginErrorFromParam', () => {
  it('aceita apenas codigo do catalogo', () => {
    expect(loginErrorFromParam('link_expired')).toBe('link_expired')
  })

  it('nao ecoa valor arbitrario da URL na tela', () => {
    expect(loginErrorFromParam('<script>alert(1)</script>')).toBeNull()
    expect(loginErrorFromParam(undefined)).toBeNull()
  })

  it('todo codigo tem mensagem em pt-BR', () => {
    for (const message of Object.values(LOGIN_ERROR_MESSAGE)) {
      expect(message.length).toBeGreaterThan(10)
    }
  })
})

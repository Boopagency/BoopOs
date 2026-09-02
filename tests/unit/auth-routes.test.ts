import { describe, expect, it } from 'vitest'
import {
  AUTH_CALLBACK_PATH,
  LOGIN_PATH,
  isProtectedPath,
  loginPathWithNext,
  safeNextPath,
} from '@/lib/auth/routes'

describe('isProtectedPath', () => {
  it('protege portal, admin e primeiro acesso', () => {
    expect(isProtectedPath('/portal')).toBe(true)
    expect(isProtectedPath('/portal/abc/conteudo')).toBe(true)
    expect(isProtectedPath('/admin')).toBe(true)
    expect(isProtectedPath('/bem-vindo')).toBe(true)
  })

  it('deixa publicas a raiz, o login e o callback', () => {
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath(LOGIN_PATH)).toBe(false)
    expect(isProtectedPath(AUTH_CALLBACK_PATH)).toBe(false)
  })

  it('nao confunde prefixo com nome de rota parecido', () => {
    /* `/portalzinho` nao e o portal — `startsWith` cru diria que e. */
    expect(isProtectedPath('/portalzinho')).toBe(false)
    expect(isProtectedPath('/administrativo')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('aceita caminho interno', () => {
    expect(safeNextPath('/portal/abc')).toBe('/portal/abc')
    expect(safeNextPath('/portal/abc?aba=conteudo')).toBe('/portal/abc?aba=conteudo')
  })

  /*
   * O par que importa: cada caso abaixo, se passasse, seria um open redirect —
   * o produto entregando uma pessoa autenticada em um host de terceiro.
   */
  it.each([
    ['URL absoluta', 'https://evil.example/portal'],
    ['esquema sem host', 'javascript:alert(1)'],
    ['protocol-relative', '//evil.example'],
    ['barra invertida que o navegador normaliza', '/\\evil.example'],
    ['caminho relativo', 'portal/abc'],
    ['vazio', ''],
    ['ausente', null],
  ])('recusa %s', (_label, value) => {
    expect(safeNextPath(value)).toBeNull()
  })

  it('recusa caractere de controle', () => {
    /* Escrito por codigo: um byte de controle literal no fonte e invisivel. */
    const withControl = (code: number) => `/portal${String.fromCharCode(code)}/abc`

    expect(safeNextPath(withControl(0x00))).toBeNull()
    expect(safeNextPath(withControl(0x0a))).toBeNull()
    expect(safeNextPath(withControl(0x0d))).toBeNull()
    expect(safeNextPath(withControl(0x7f))).toBeNull()
  })

  it('recusa voltar para o login ou para o callback', () => {
    expect(safeNextPath(LOGIN_PATH)).toBeNull()
    expect(safeNextPath(`${LOGIN_PATH}?erro=link_expired`)).toBeNull()
    expect(safeNextPath(AUTH_CALLBACK_PATH)).toBeNull()
    expect(safeNextPath(`${AUTH_CALLBACK_PATH}?code=abc`)).toBeNull()
  })
})

describe('loginPathWithNext', () => {
  it('preserva o destino, codificado', () => {
    expect(loginPathWithNext('/portal/abc', '?aba=conteudo')).toBe(
      '/login?next=%2Fportal%2Fabc%3Faba%3Dconteudo',
    )
  })

  it('cai no login puro quando o destino nao e seguro', () => {
    expect(loginPathWithNext(LOGIN_PATH)).toBe(LOGIN_PATH)
  })
})

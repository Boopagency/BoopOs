/**
 * Logger estruturado minimo. Existe para que `console.log` nunca apareca no
 * codigo de producao (regra aplicada pelo ESLint) e para que exista um unico
 * ponto a conectar em observabilidade real depois.
 *
 * REGRA DE SEGURANCA (docs/security.md): nunca registrar token, senha, cookie,
 * header Authorization, service role, signed URL, corpo de e-mail, resposta de
 * onboarding ou legenda de conteudo. O `redact` abaixo e uma rede de protecao,
 * nao uma licenca para jogar objetos inteiros aqui dentro.
 */
import { isDevelopment, isTest } from '@/config/env'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = Record<string, unknown>

const REDACTED = '[redacted]'

const SENSITIVE_KEY = /(token|secret|password|senha|key|authorization|cookie|signed_?url)/i

/** Substitui valores de chaves sensiveis, em qualquer profundidade. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return REDACTED
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(val, depth + 1)
  }
  return out
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  if (isTest) return

  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  }

  const line = isDevelopment ? entry : JSON.stringify(entry)

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (isDevelopment) emit('debug', message, context)
  },
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
}

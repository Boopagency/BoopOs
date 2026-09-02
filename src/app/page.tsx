import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth/actor'
import { AFTER_LOGIN_PATH, LOGIN_PATH } from '@/lib/auth/routes'

/**
 * A raiz nao renderiza: decide.
 *
 * Com sessao ativa, vai para o destino autenticado; sem sessao, para o login.
 * A decisao acontece no servidor, entao nao existe o piscar de uma tela que a
 * pessoa nao podia ver.
 *
 * Ate a FASE 2 esta rota era o indice do prototipo, que abria o fluxo durante
 * a revisao. Ele cumpriu o papel: com login de verdade, o caminho para o
 * produto passa a ser entrar nele. O que aquele indice mostrava de util
 * (quais integracoes estao configuradas) continua coberto por
 * `integrationStatus()` e pelo teste em tests/unit/env.test.ts.
 */
export default async function HomePage() {
  const actor = await getActor()

  redirect(actor?.status === 'active' ? AFTER_LOGIN_PATH : LOGIN_PATH)
}

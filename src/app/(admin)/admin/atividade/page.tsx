import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { ACTIVITY_PAGE_SIZE, listRecentActivityForBoop } from '@/lib/activity/queries'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Atividade' }

/**
 * O activity log, visível para a Boop.
 *
 * `client_user` não chega aqui por três caminhos independentes: `requireBoop()`
 * no layout, `requireBoop()` dentro da query, e `activity_log_select`, que
 * exige `is_boop()` — a matriz não dá `activity.read` ao cliente (D-05).
 *
 * O que a tela mostra de `metadata` é escolhido a dedo em `queries.ts`: papel e
 * status, que descrevem a transição. Não há despejo de JSON — a tabela guarda
 * identificadores e transições, e a tela não é o lugar de descobrir que um dia
 * guardou outra coisa.
 */
export default async function ActivityPage() {
  const entries = await listRecentActivityForBoop()

  return (
    <Container>
      <SectionHeading
        as="h1"
        eyebrow="Operação"
        title="Atividade"
        lead="O registro do que aconteceu. Append-only: nada aqui é editado ou apagado."
      />

      {entries.length === 0 ? (
        <p className="t-body text-muted measure mt-12">
          Nada registrado ainda. Os eventos aparecem conforme a operação acontece.
        </p>
      ) : (
        <>
          <ul className="border-rule divide-rule mt-12 divide-y border-t">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-6 gap-y-1 py-4">
                <time
                  dateTime={entry.createdAt}
                  className="t-label text-muted w-44 shrink-0 tabular-nums"
                >
                  {formatDateTime(entry.createdAt)}
                </time>

                <p className="t-body text-foreground min-w-0 flex-1">
                  <span className="text-foreground">{entry.actorName ?? 'Alguém'}</span>{' '}
                  <span className="text-muted">{entry.actionLabel}</span>
                  {entry.clientName && (
                    <>
                      {' '}
                      {entry.clientId ? (
                        <Link
                          href={`/admin/clientes/${entry.clientId}`}
                          className="decoration-rule-strong hover:decoration-accent underline underline-offset-4"
                        >
                          {entry.clientName}
                        </Link>
                      ) : (
                        entry.clientName
                      )}
                    </>
                  )}
                  {entry.detail && <span className="text-muted"> · {entry.detail}</span>}
                </p>
              </li>
            ))}
          </ul>

          {entries.length === ACTIVITY_PAGE_SIZE && (
            <p className="t-label text-muted mt-6">
              Mostrando os {ACTIVITY_PAGE_SIZE} eventos mais recentes.
            </p>
          )}
        </>
      )}
    </Container>
  )
}

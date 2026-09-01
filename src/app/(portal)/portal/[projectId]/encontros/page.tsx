import type { Metadata } from 'next'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { EmptyState } from '@/components/patterns/empty-state'
import { MEETING_TYPE_LABEL } from '@/config/enums'
import { getMeetings } from '@/lib/data/portal'
import { formatDayMonth, formatFullDate, formatTime, formatWeekdayCapitalized } from '@/lib/format'

export const metadata: Metadata = { title: 'Encontros' }

export default async function MeetingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const meetings = await getMeetings(projectId)
  const next = meetings.find((m) => m.status === 'scheduled')
  const past = meetings.filter((m) => m.status === 'completed').reverse()

  if (meetings.length === 0) {
    return (
      <div className="content">
        <EmptyState title="Nenhum encontro marcado ainda.">
          Assim que agendarmos o próximo, ele aparece aqui com data, hora e link.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      {next && (
        <section
          aria-labelledby="proximo"
          className="on-inverse bg-navy relative isolate overflow-hidden"
        >
          <CloudLayer density="single" className="opacity-20 mix-blend-screen" />
          <div className="content relative py-14 md:py-20">
            <h1 id="proximo" className="t-meta text-sky">
              Próximo encontro
            </h1>
            <p className="t-section text-cloud mt-6 max-w-[18ch]">{next.title}</p>
            {next.description && (
              <p className="t-body measure text-muted-on-inverse mt-5">{next.description}</p>
            )}

            <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-6">
              <p>
                <span className="t-meta text-muted-on-inverse block">
                  {formatWeekdayCapitalized(next.startAt)}
                </span>
                <span className="t-section text-cloud mt-1 block" data-numeric>
                  {formatDayMonth(next.startAt)}
                </span>
              </p>
              <p>
                <span className="t-meta text-muted-on-inverse block">Horário</span>
                <span className="t-section text-cloud mt-1 block" data-numeric>
                  {formatTime(next.startAt)}
                </span>
              </p>
              <p>
                <span className="t-meta text-muted-on-inverse block">Duração</span>
                <span className="t-section text-cloud mt-1 block" data-numeric>
                  {next.durationMinutes} min
                </span>
              </p>
            </div>

            {next.url && (
              <a
                href={next.url}
                className="t-meta bg-accent text-accent-foreground hover:bg-accent-hover mt-10 inline-flex h-14 items-center rounded-sm px-8 transition-colors duration-[--motion-fast] max-sm:w-full max-sm:justify-center"
              >
                Entrar na sala
              </a>
            )}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="anteriores" className="content py-16 md:py-20">
          <h2 id="anteriores" className="t-meta text-muted">
            Encontros anteriores
          </h2>
          <ul className="divide-rule border-rule mt-8 divide-y border-y">
            {past.map((meeting) => (
              <li key={meeting.id} className="py-6">
                <p className="t-meta text-muted">{MEETING_TYPE_LABEL[meeting.type]}</p>
                <p className="t-title text-foreground mt-2">{meeting.title}</p>
                <p className="t-label text-muted mt-2">
                  {formatFullDate(meeting.startAt)} · {formatTime(meeting.startAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'
import { SectionHeading } from '@/components/patterns/section-heading'
import { FILE_CATEGORIES, FILE_CATEGORY_LABEL, type FileCategory } from '@/config/enums'
import { getFiles } from '@/lib/data/portal'
import { formatFullDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Arquivos' }

/*
 * Nao e um clone de drive: nao ha arvore de pastas, upload, renomear nem
 * mover. Sao os arquivos do projeto, agrupados pelo papel que cumprem.
 */
export default async function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const files = await getFiles(projectId)

  if (files.length === 0) {
    return (
      <div className="content">
        <EmptyState title="Ainda não há arquivos por aqui.">
          Materiais de marca, estratégia e conteúdo aparecem nesta página conforme forem entregues.
        </EmptyState>
      </div>
    )
  }

  const groups = FILE_CATEGORIES.map((category: FileCategory) => ({
    category,
    items: files.filter((file) => file.category === category),
  })).filter((group) => group.items.length > 0)

  return (
    <section className="content py-14 md:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Arquivos"
        title="Tudo que já entregamos"
        lead="Os materiais do projeto, organizados pelo papel que cumprem."
      />

      <div className="mt-14 space-y-14">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`cat-${group.category}`}>
            <h2 id={`cat-${group.category}`} className="t-meta text-muted">
              {FILE_CATEGORY_LABEL[group.category]}
            </h2>
            <ul className="divide-rule border-rule mt-5 divide-y border-y">
              {group.items.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="hover:bg-surface-soft/50 flex w-full items-center justify-between gap-6 py-5 text-left transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="t-title text-foreground block truncate">{file.name}</span>
                      <span className="t-meta text-muted mt-1.5 block">
                        {file.kind} · {file.sizeLabel} · {formatFullDate(file.addedOn)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="t-title text-muted shrink-0">
                      ↓
                    </span>
                    <span className="sr-only">Baixar {file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="t-label text-muted mt-12">
        Protótipo: os downloads ainda não estão ligados. Na FASE 12 cada arquivo passa a ser servido
        por URL assinada de curta duração.
      </p>
    </section>
  )
}

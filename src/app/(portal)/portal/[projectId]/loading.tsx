import { Spinner } from '@/components/ui/spinner'

export default function PortalLoading() {
  return (
    <div className="content flex min-h-[50vh] items-center justify-center py-24">
      <Spinner label="Carregando o projeto" />
    </div>
  )
}

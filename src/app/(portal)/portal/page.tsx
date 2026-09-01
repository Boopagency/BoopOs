import { redirect } from 'next/navigation'
import { DEMO_PROJECT_ID } from '@/lib/data/portal'

/**
 * Com um unico projeto acessivel, `/portal` leva direto a ele e nenhum
 * seletor aparece — a complexidade fica invisivel (docs/product.md).
 *
 * Na FASE 6 isto passa a consultar os projetos do usuario: um projeto
 * redireciona, dois ou mais mostram a escolha.
 */
export default function PortalIndex() {
  redirect(`/portal/${DEMO_PROJECT_ID}`)
}

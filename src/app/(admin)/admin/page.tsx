import { redirect } from 'next/navigation'

/**
 * `/admin` nao e uma tela: e a porta.
 *
 * A operacao interna comeca em clientes — e o tenant, e todo o resto (pessoas,
 * projetos, conteudo) pendura nele. Uma pagina inicial com tres atalhos para
 * as tres abas que ja estao na barra de navegacao seria uma tela a mais para
 * atravessar, e "admin virando ERP" e um risco nomeado no roadmap.
 *
 * O guard nao mora aqui: `(admin)/layout.tsx` chama `requireBoop()` e vale
 * para o grupo inteiro, inclusive para este redirect.
 */
export default function AdminIndex() {
  redirect('/admin/clientes')
}

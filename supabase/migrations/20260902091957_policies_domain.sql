-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4 — POLÍTICAS: ONBOARDING, ESTRATÉGIA, CONTEÚDO, SISTEMA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Catorze tabelas. Duas perguntas se repetem em todas:
--
--   1. este cliente é meu?           → app.has_client_access(client_id)
--   2. isto já foi compartilhado?    → um predicado de estado, só para client_user
--
-- A pergunta 2 é a que separa esta fase de "isolamento entre tenants". Cliente
-- A não alcançar Cliente B é o caso óbvio. O vazamento provável é outro: o
-- cliente enxergando rascunho, nota interna e comentário interno DENTRO DO
-- PRÓPRIO tenant. Todo `not app.is_client_user() or ...` abaixo é uma dessas
-- portas, e cada uma tem teste negativo.

-- ═══════════════════════════════════════════════════════════════════════════
-- RESOLVERS DAS TABELAS SEM client_id
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Regra desta fase: **toda tabela sem `client_id` ganha exatamente uma função
-- que resolve o seu escopo.** Não é invenção caso a caso — é o que substitui o
-- `has_client_access(client_id)` que essas tabelas não podem escrever.
--
-- Por que função e não subquery na policy: uma subquery sobre tabela com RLS,
-- dentro de uma policy, é filtrada pela policy DAQUELA tabela. A avaliação de
-- uma policy passa a depender da avaliação de outra, o plano fica sensível à
-- ordem e o predicado deixa de ser legível. `security definer` roda a subquery
-- sem RLS e concentra a decisão em um lugar só.

-- Seção -> template. Usada pela policy de `onboarding_questions`, que só
-- alcança o template atravessando a seção.
create or replace function app.has_section_access(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.onboarding_sections s
     where s.id = p_section_id
       and app.has_template_access(s.template_id)
  )
$$;

comment on function app.has_section_access(uuid) is
  'Secao -> template -> has_template_access. Escopo de onboarding_questions.';

-- Resposta -> submissão -> cliente. Leitura.
create or replace function app.has_submission_access(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.onboarding_submissions s
     where s.id = p_submission_id
       and app.has_client_access(s.client_id)
  )
$$;

comment on function app.has_submission_access(uuid) is
  'Resposta -> submissao -> cliente. Escopo de leitura de onboarding_answers.';

-- Escrita de resposta. Separada da leitura porque carrega a trava de estado:
-- o cliente responde enquanto a submissão é `draft` e para de responder depois
-- de enviar. O time da Boop não tem essa trava (matriz de permissões).
create or replace function app.can_answer_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.onboarding_submissions s
     where s.id = p_submission_id
       and app.has_client_access(s.client_id)
       and (not app.is_client_user() or s.status = 'draft')
  )
$$;

comment on function app.can_answer_submission(uuid) is
  'Escrita de resposta: cliente so enquanto a submissao e draft; Boop sempre.';

do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'app.has_section_access(uuid)',
    'app.has_submission_access(uuid)',
    'app.can_answer_submission(uuid)'
  ];
begin
  foreach v_signature in array v_signatures loop
    execute format('revoke all on function %s from public', v_signature);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_signature);
  end loop;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CATÁLOGO DE ONBOARDING — global para a Boop, derivado para o cliente
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `onboarding_templates`, `_sections` e `_questions` não pertencem a tenant
-- nenhum: são o catálogo da operação. O time da Boop lê tudo. O `client_user`
-- alcança apenas o template que a PRÓPRIA submissão usa — e o caminho é sempre
-- submissão -> template, nunca o `template_id` que o navegador mandar.
--
-- Escrita: só `boop_admin` (`onboarding.template.manage` na matriz). Um
-- `boop_member` que pudesse editar pergunta mudaria o onboarding de todos os
-- clientes de uma vez.

create policy onboarding_templates_select on public.onboarding_templates
for select to authenticated
using (app.has_template_access(id));

create policy onboarding_templates_insert on public.onboarding_templates
for insert to authenticated
with check (app.is_boop_admin());

create policy onboarding_templates_update on public.onboarding_templates
for update to authenticated
using (app.is_boop_admin())
with check (app.is_boop_admin());

create policy onboarding_templates_delete on public.onboarding_templates
for delete to authenticated
using (app.is_boop_admin());

grant select, insert, update, delete on public.onboarding_templates to authenticated;

create policy onboarding_sections_select on public.onboarding_sections
for select to authenticated
using (app.has_template_access(template_id));

create policy onboarding_sections_insert on public.onboarding_sections
for insert to authenticated
with check (app.is_boop_admin());

create policy onboarding_sections_update on public.onboarding_sections
for update to authenticated
using (app.is_boop_admin())
with check (app.is_boop_admin());

create policy onboarding_sections_delete on public.onboarding_sections
for delete to authenticated
using (app.is_boop_admin());

grant select, insert, update, delete on public.onboarding_sections to authenticated;

create policy onboarding_questions_select on public.onboarding_questions
for select to authenticated
using (app.has_section_access(section_id));

create policy onboarding_questions_insert on public.onboarding_questions
for insert to authenticated
with check (app.is_boop_admin());

create policy onboarding_questions_update on public.onboarding_questions
for update to authenticated
using (app.is_boop_admin())
with check (app.is_boop_admin());

create policy onboarding_questions_delete on public.onboarding_questions
for delete to authenticated
using (app.is_boop_admin());

grant select, insert, update, delete on public.onboarding_questions to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- onboarding_submissions
-- ═══════════════════════════════════════════════════════════════════════════

create policy onboarding_submissions_select on public.onboarding_submissions
for select to authenticated
using (app.has_client_access(client_id));

create policy onboarding_submissions_insert on public.onboarding_submissions
for insert to authenticated
with check (app.is_boop() and app.has_client_access(client_id));

-- O USING olha a linha ANTES, o WITH CHECK olha a linha DEPOIS, e a diferença
-- importa aqui: o cliente só age sobre uma submissão `draft` (USING), e o
-- envio a leva para `submitted` (WITH CHECK, que não repete a trava). Repetir
-- `status = 'draft'` no WITH CHECK tornaria o próprio envio impossível.
create policy onboarding_submissions_update on public.onboarding_submissions
for update to authenticated
using (
  app.has_client_access(client_id)
  and (not app.is_client_user() or status = 'draft')
)
with check (app.has_client_access(client_id));

-- SEM DELETE: a submissão é o registro do que o cliente respondeu.

grant select, insert, update on public.onboarding_submissions to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- onboarding_answers — sem client_id, escopo pela submissão
-- ═══════════════════════════════════════════════════════════════════════════

create policy onboarding_answers_select on public.onboarding_answers
for select to authenticated
using (app.has_submission_access(submission_id));

create policy onboarding_answers_insert on public.onboarding_answers
for insert to authenticated
with check (app.can_answer_submission(submission_id));

create policy onboarding_answers_update on public.onboarding_answers
for update to authenticated
using (app.can_answer_submission(submission_id))
with check (app.can_answer_submission(submission_id));

-- SEM DELETE: apagar resposta é reescrever o que o cliente disse.

grant select, insert, update on public.onboarding_answers to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA
-- ═══════════════════════════════════════════════════════════════════════════

create policy strategies_select on public.strategies
for select to authenticated
using (app.has_client_access(client_id));

create policy strategies_insert on public.strategies
for insert to authenticated
with check (app.is_boop() and app.has_client_access(client_id));

create policy strategies_update on public.strategies
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

grant select, insert, update on public.strategies to authenticated;

-- `draft` é trabalho em andamento da Boop. O cliente vê a partir do momento em
-- que a versão sai para aprovação, e não antes.
create policy strategy_versions_select on public.strategy_versions
for select to authenticated
using (
  app.has_client_access(client_id)
  and (not app.is_client_user() or status <> 'draft')
);

create policy strategy_versions_insert on public.strategy_versions
for insert to authenticated
with check (app.is_boop() and app.has_client_access(client_id));

-- Só a Boop escreve. A aprovação do cliente NÃO acontece por UPDATE aqui: ela
-- é transição de máquina de estados e vai por RPC na FASE 11.
create policy strategy_versions_update on public.strategy_versions
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

grant select, insert, update on public.strategy_versions to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTEÚDO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `idea`, `planned`, `in_production` e `internal_review` são bastidor. O
-- cliente entra na conversa em `awaiting_client`.

create policy content_items_select on public.content_items
for select to authenticated
using (
  app.has_client_access(client_id)
  and (
    not app.is_client_user()
    or status in ('awaiting_client', 'changes_requested', 'approved', 'scheduled', 'published')
  )
);

create policy content_items_insert on public.content_items
for insert to authenticated
with check (app.is_boop() and app.has_client_access(client_id));

create policy content_items_update on public.content_items
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

create policy content_items_delete on public.content_items
for delete to authenticated
using (app.is_boop_admin() and app.has_client_access(client_id));

grant select, insert, update, delete on public.content_items to authenticated;

-- `sent_for_approval_at is not null` em vez de olhar o status: é o carimbo que
-- diz "isto saiu da Boop". Uma versão que voltou para `draft` depois de
-- enviada continua visível, e é o correto — o cliente já a viu.
--
-- ⚠️ `internal_notes` vive nesta tabela e o cliente não pode lê-la. RLS é
-- row-level: a linha inteira volta. A proteção é a projeção do servidor, e a
-- dívida está registrada em docs/security.md junto com `clients.notes`.
create policy content_versions_select on public.content_versions
for select to authenticated
using (
  app.has_client_access(client_id)
  and (not app.is_client_user() or sent_for_approval_at is not null)
);

create policy content_versions_insert on public.content_versions
for insert to authenticated
with check (app.is_boop() and app.has_client_access(client_id));

create policy content_versions_update on public.content_versions
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

create policy content_versions_delete on public.content_versions
for delete to authenticated
using (app.is_boop_admin() and app.has_client_access(client_id));

grant select, insert, update, delete on public.content_versions to authenticated;

-- O comentário interno é a conversa da Boop sobre o trabalho do cliente,
-- gravada na mesma tabela que a conversa COM o cliente. Uma policy errada aqui
-- não vaza dado de outro tenant: vaza o que a equipe disse sobre este.
create policy content_comments_select on public.content_comments
for select to authenticated
using (
  app.has_client_access(client_id)
  and (not app.is_client_user() or is_internal = false)
);

-- O cliente comenta, mas nunca marca o próprio comentário como interno — seria
-- escrever na conversa que ele não pode ler.
create policy content_comments_insert on public.content_comments
for insert to authenticated
with check (
  app.has_client_access(client_id)
  and (not app.is_client_user() or is_internal = false)
  -- Autoria é de quem escreve. Comentar em nome de outra pessoa é falsificar
  -- registro, e `author_id` é exatamente o que a tela mostra.
  and (author_id is null or author_id = (select auth.uid()))
);

create policy content_comments_update on public.content_comments
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

create policy content_comments_delete on public.content_comments
for delete to authenticated
using (app.is_boop_admin() and app.has_client_access(client_id));

grant select, insert, update, delete on public.content_comments to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- APROVAÇÕES — leitura e nada mais
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ REGRA CRÍTICA: `strategy_approvals` e `content_approvals` NÃO têm policy
-- de INSERT, UPDATE ou DELETE. Para ninguém. Nem para `boop_admin`.
--
-- Aprovação é registro de decisão do cliente, e é o que dá valor ao sistema
-- inteiro. Se ela pudesse ser gravada por `insert` direto na Data API, bastaria
-- uma linha de SQL para dizer que o cliente aprovou algo que ele nunca viu — e
-- a máquina de estados que valida "esta versão estava mesmo aguardando
-- aprovação?" seria contornada por completo.
--
-- A escrita chega na FASE 11, por função `security definer` chamada por `rpc`,
-- que valida a transição antes de gravar. Até lá não existe caminho de
-- escrita, e o GRANT abaixo concede apenas SELECT — sem GRANT de insert, nem a
-- ausência de policy precisa ser a única defesa.
--
-- `boop_admin` não aprovar não é limitação de escopo: escopo global é sobre
-- QUAIS clientes ele alcança, não sobre quais invariantes de domínio ele pode
-- quebrar (docs/permissions.md).

create policy strategy_approvals_select on public.strategy_approvals
for select to authenticated
using (app.has_client_access(client_id));

grant select on public.strategy_approvals to authenticated;

create policy content_approvals_select on public.content_approvals
for select to authenticated
using (app.has_client_access(client_id));

grant select on public.content_approvals to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- activity_log — interno, append-only, e invisível ao cliente
-- ═══════════════════════════════════════════════════════════════════════════
--
-- D-05: o cliente NÃO vê o log na V0. A coluna `visibility` já existe para
-- quando essa decisão mudar, mas hoje nem sequer chega a ser consultada — o
-- predicado exige `app.is_boop()` antes de qualquer outra coisa.
--
-- `client_id` é NULLABLE aqui, e isso precisa de decisão explícita: uma linha
-- de sistema (sem cliente) não pertence a tenant nenhum, então `boop_member`
-- não a alcança. Só `boop_admin`. Escrever apenas
-- `app.has_client_access(client_id)` deixaria essas linhas invisíveis para
-- todos por acidente — e um dia alguém "consertaria" isso com um `or client_id
-- is null`, que as tornaria visíveis para qualquer membro. Fica explícito.
create policy activity_log_select on public.activity_log
for select to authenticated
using (
  app.is_boop_admin()
  or (app.is_boop() and client_id is not null and app.has_client_access(client_id))
);

-- SEM INSERT pela Data API. A escrita passa por `app.record_activity()`
-- (migration ..._authorization_boundaries), que é o único caminho da aplicação
-- e carimba `actor_id` a partir da sessão.
--
-- SEM UPDATE e SEM DELETE: append-only por ADR-0012/0019. O trigger
-- `app.reject_mutation()` já rejeita as duas operações inclusive para
-- `service_role`; a ausência de policy e de GRANT são a segunda e a terceira
-- fechaduras.

grant select on public.activity_log to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- notifications — operação da Boop, não do cliente
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Matriz: `notification.read` e `notification.resend` são de `boop_admin`.
-- Nem `boop_member`, nem cliente. `client_id` também é nullable e, com o
-- predicado sendo só `is_boop_admin()`, o NULL não abre exceção nenhuma —
-- fail closed sem precisar de caso especial.
--
-- A escrita é do servidor (FASE 16), não da Data API: sem policy, sem GRANT.
create policy notifications_select on public.notifications
for select to authenticated
using (app.is_boop_admin());

grant select on public.notifications to authenticated;

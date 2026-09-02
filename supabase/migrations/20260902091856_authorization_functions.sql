-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4 — FUNÇÕES DE AUTORIZAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- As policies precisam responder, em quase toda avaliação, duas perguntas:
-- qual o papel de quem está pedindo, e ele alcança este cliente. Escrever isso
-- direto no predicado provoca recursão — uma policy sobre `profiles` que
-- consulta `profiles`, `clients` → `client_memberships` → `clients`.
--
-- Por isso todas moram aqui, em `app`, e todas são `security definer`: definer
-- ignora RLS por definição, e é isso que quebra o ciclo (ADR-0004).
--
-- Cinco propriedades valem para todas, sem exceção:
--
--   1. `security definer`     — quebra a recursão de policy
--   2. `stable`               — o planejador reaproveita o resultado na query
--   3. `set search_path = ''` — nada resolve por caminho; tudo qualificado
--   4. identidade de `(select auth.uid())`, NUNCA de argumento
--   5. `revoke execute from public` + grant explícito
--
-- A regra 4 é a que mais importa. Nenhuma função aqui aceita `user_id` como
-- parâmetro. Se aceitasse, a autorização passaria a depender de um valor que
-- o chamador escolhe — e o chamador, no fim da linha, é o navegador.

-- ═══════════════════════════════════════════════════════════════════════════
-- actor_role() — o papel de quem está pedindo, ou NULL
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `status = 'active'` no predicado é a revogação valendo no banco: quem está
-- `disabled` ou ainda `invited` não tem papel, e sem papel nenhuma policy
-- concede nada. O cookie continua tecnicamente válido; o acesso, não.
--
-- É deliberadamente a MESMA regra do `requireActor()` na aplicação. As duas
-- camadas dizem a mesma coisa, e é isso que se espera delas.
create or replace function app.actor_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from public.profiles p
   where p.id = (select auth.uid())
     and p.status = 'active'
$$;

comment on function app.actor_role() is
  'Papel global de quem faz o request, ou NULL se nao houver perfil ativo. '
  'status <> active devolve NULL: e onde a revogacao vale no banco.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Predicados de papel
-- ═══════════════════════════════════════════════════════════════════════════
-- `is not distinct from` em vez de `=`: com NULL (anônimo, sem perfil,
-- desligado) o `=` devolve NULL, e NULL em policy não concede — mas também não
-- nega de forma legível. Aqui o retorno é sempre boolean, nunca NULL, e o
-- teste de cada função pode afirmar `false` em vez de `is null`.
create or replace function app.is_boop_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select app.actor_role() is not distinct from 'boop_admin'::public.user_role $$;

comment on function app.is_boop_admin() is
  'true apenas para boop_admin ativo. Escopo global (D-08).';

create or replace function app.is_boop()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(app.actor_role() in ('boop_admin', 'boop_member'), false) $$;

comment on function app.is_boop() is
  'true para o time da Boop (admin ou member) ativo.';

create or replace function app.is_client_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select app.actor_role() is not distinct from 'client_user'::public.user_role $$;

comment on function app.is_client_user() is
  'true apenas para client_user ativo. Usado para RESTRINGIR, nunca para conceder.';

-- ═══════════════════════════════════════════════════════════════════════════
-- has_client_access(client_id) — o coração do multi-tenant
-- ═══════════════════════════════════════════════════════════════════════════
--
-- D-08, materializada:
--
--   boop_admin  → true sempre (escopo global, dispensa vínculo)
--   boop_member → true só com vínculo explícito
--   client_user → true só com vínculo explícito
--   disabled    → false (actor_role() devolve NULL, e o exists exige perfil ativo)
--   anônimo     → false (auth.uid() é NULL, e nenhuma linha casa)
--
-- O `exists` confere `p.status = 'active'` de novo, e isso não é redundância
-- desnecessária: sem ele, um vínculo sobrevivente de alguém desligado
-- concederia acesso pelo segundo braço do `or`, contornando o primeiro.
create or replace function app.has_client_access(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_client_id is not null
     and (
       app.is_boop_admin()
       or exists (
         select 1
           from public.client_memberships m
           join public.profiles p on p.id = m.user_id
          where m.client_id = p_client_id
            and m.user_id = (select auth.uid())
            and p.status = 'active'
       )
     )
$$;

comment on function app.has_client_access(uuid) is
  'Acesso ao tenant: boop_admin global, os demais so com vinculo ativo (D-08). '
  'NULL devolve false — fail closed para linha sem tenant.';

-- ═══════════════════════════════════════════════════════════════════════════
-- has_project_access(project_id) — projeto resolve para cliente
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Não duplica a regra de tenant: descobre o cliente do projeto e delega. Um
-- `project_id` vindo da URL é apenas um endereço; quem decide é o vínculo com
-- o cliente daquele projeto.
create or replace function app.has_project_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.projects pr
     where pr.id = p_project_id
       and app.has_client_access(pr.client_id)
  )
$$;

comment on function app.has_project_access(uuid) is
  'Projeto -> cliente -> has_client_access. project_id da URL e endereco, nao prova.';

-- ═══════════════════════════════════════════════════════════════════════════
-- has_template_access(template_id) — o catálogo de onboarding
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A sétima função, e a única fora do desenho original de docs/security.md.
-- A necessidade é concreta, não estética:
--
-- `onboarding_templates`, `_sections` e `_questions` são catálogo GLOBAL — não
-- têm `client_id` e não pertencem a tenant nenhum. O time da Boop lê o
-- catálogo inteiro. O `client_user` só pode alcançar o template que a PRÓPRIA
-- submissão usa, e isso exige atravessar `onboarding_submissions`.
--
-- Escrever esse `exists` dentro da policy seria consultar uma tabela que tem
-- RLS de dentro da avaliação de outra policy: a subquery passaria a ser
-- filtrada pela policy de `onboarding_submissions`, que por sua vez chama
-- `has_client_access` — dependência circular entre policies, e um plano que
-- muda conforme a ordem de avaliação. `security definer` corta isso: a
-- subquery roda sem RLS, e a decisão fica em um lugar só.
--
-- O template NÃO é confiado a partir do id que o frontend manda: o caminho é
-- sempre submissão → template, nunca template → submissão.
create or replace function app.has_template_access(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_boop()
      or exists (
        select 1
          from public.onboarding_submissions s
         where s.template_id = p_template_id
           and app.has_client_access(s.client_id)
      )
$$;

comment on function app.has_template_access(uuid) is
  'Catalogo de onboarding: Boop le tudo; client_user so o template que a '
  'propria submissao usa. Derivado da submissao, nunca do id que o front manda.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Privilégio de execução
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Uma função `security definer` executável por `public` é uma escalada de
-- privilégio esperando acontecer. `authenticated` executa porque as policies
-- rodam em nome dele; `anon` também, e de propósito: sem `auth.uid()` toda
-- função devolve false ou NULL, e negar a execução só trocaria "nega" por
-- "erro de permissão" no meio de uma policy.
--
-- O schema `app` continua sem `usage` para os dois (migration 20260901140001),
-- então nada disto é chamável pela API — só de dentro das policies.
do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'app.actor_role()',
    'app.is_boop_admin()',
    'app.is_boop()',
    'app.is_client_user()',
    'app.has_client_access(uuid)',
    'app.has_project_access(uuid)',
    'app.has_template_access(uuid)'
  ];
begin
  foreach v_signature in array v_signatures loop
    execute format('revoke all on function %s from public', v_signature);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_signature);
  end loop;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4 — POLÍTICAS: IDENTIDADE, TENANT E PROJETO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cinco tabelas: `profiles`, `clients`, `client_memberships`, `projects`,
-- `project_stages`. São a base — todas as outras resolvem escopo através delas.
--
-- DUAS FECHADURAS. A migration `20260901140008` revogou todo privilégio de
-- `anon` e `authenticated`. Conceder de novo é parte desta fase, e o GRANT
-- nasce ao lado da policy que o acompanha, nunca em outro arquivo: policy sem
-- GRANT deixa a tabela morta em silêncio, e GRANT sem policy é uma porta que
-- só a RLS está segurando.
--
-- AUSÊNCIA DE POLICY É DECISÃO. Onde uma operação deve ser impossível, não há
-- policy — e também não há GRANT. Cada ausência está comentada abaixo, e o
-- teste de varredura confere a matriz inteira contra o que está declarado aqui.
--
-- `anon` não recebe nada, em nenhuma tabela, em nenhuma operação.

-- ═══════════════════════════════════════════════════════════════════════════
-- profiles — a tabela de identidade
-- ═══════════════════════════════════════════════════════════════════════════

-- A leitura de perfil em uma função só. O `exists` cruzado responde "somos do
-- mesmo cliente" sem que a policy precise consultar `client_memberships`
-- diretamente — o que faria a avaliação de uma policy depender da avaliação de
-- outra, com plano sensível à ordem. Definer resolve em um lugar só.
create or replace function app.has_profile_access(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid())            -- o próprio, sempre
      or app.is_boop_admin()                            -- escopo global (D-08)
      or (
        app.is_boop()                                   -- member: só quem divide cliente
        and exists (
          select 1
            from public.client_memberships mine
            join public.client_memberships theirs
              on theirs.client_id = mine.client_id
           where mine.user_id = (select auth.uid())
             and theirs.user_id = p_profile_id
        )
      )
$$;

comment on function app.has_profile_access(uuid) is
  'Leitura de perfil: o proprio sempre; boop_admin todos; boop_member so quem '
  'divide cliente. client_user nunca alcanca terceiro (docs/permissions.md).';

-- ⚠️ O primeiro braço — o próprio perfil — NÃO passa por `actor_role()`, e
-- portanto não exige `status = 'active'`. É deliberado, e é o que permite ao
-- `getActor()` funcionar pelo JWT do usuário:
--
--   `invited`   precisa ser lido para a aplicação dizer "ative seu acesso";
--   `disabled`  precisa ser lido para a aplicação dizer "acesso revogado".
--
-- Se a policy exigisse `active`, `getActor()` devolveria `null` nos dois casos
-- e as duas situações virariam o mesmo redirect genérico para `/login` — a
-- pessoa desligada ficaria sem saber por que parou de entrar, e a recém-
-- convidada tampouco.
--
-- O que essa leitura concede é exatamente uma linha: a própria. `role` e
-- `status` dela já são conhecidos de quem os possui, e nenhuma outra policy
-- deriva acesso daí: `app.has_client_access()` continua `false` para quem não
-- está ativo, então o perfil legível não abre porta nenhuma. O teste de
-- isolamento afirma as duas metades — a linha própria aparece, e mais nada.

revoke all on function app.has_profile_access(uuid) from public;
grant execute on function app.has_profile_access(uuid) to anon, authenticated, service_role;

create policy profiles_select on public.profiles
for select to authenticated
using (app.has_profile_access(id));

-- SEM policy de INSERT. O perfil é espelho de `auth.users` e nasce pelo
-- trigger `app.handle_new_auth_user()`. Criar perfil pela Data API seria
-- inventar identidade — e, com `role` default, inventar papel junto.

-- SEM policy de UPDATE, e isto é o ponto mais importante do arquivo.
--
-- Conceder UPDATE da própria linha parece inofensivo e não é: `role` e
-- `status` moram nesta tabela. `update profiles set role = 'boop_admin' where
-- id = auth.uid()` é escalada de privilégio em uma linha de SQL, e uma policy
-- com `using (id = auth.uid())` a autorizaria.
--
-- A promoção `invited -> active` do primeiro login é real e precisa acontecer.
-- Ela passa por `app.promote_invited_profile()` (migration ..._authorization_
-- boundaries), que é `security definer`, só atende a própria linha e só faz
-- aquela transição. Fora dali, `profiles` não se escreve pela API.

-- SEM policy de DELETE. Sai por cascade de `auth.users`, e a pessoa some do
-- log por ADR-0019 — não por DELETE direto.

grant select on public.profiles to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- clients — o tenant
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  LIMITAÇÃO CONHECIDA E DOCUMENTADA: `clients.notes` é nota interna da
-- Boop e o cliente não pode lê-la. RLS é row-level, não column-level, e
-- `authenticated` é um papel só para as três personas — não há GRANT de coluna
-- capaz de separar `boop_member` de `client_user` aqui.
--
-- A proteção efetiva de `notes` é a projeção do lado do servidor: nenhuma
-- leitura client-facing seleciona a coluna, e `select *` é proibido pela regra
-- do repositório. Enquanto o portal lê mocks (FASE 5 é quem liga o dado real)
-- não existe caminho que a exponha. Registrado como dívida de segurança em
-- docs/security.md — a FASE 5 é obrigada a fechar isso com projeção explícita
-- ou view client-facing.

create policy clients_select on public.clients
for select to authenticated
using (app.has_client_access(id));

create policy clients_insert on public.clients
for insert to authenticated
with check (app.is_boop_admin());

-- UPDATE com USING **e** WITH CHECK. Sem o WITH CHECK, quem pode editar um
-- cliente poderia reescrevê-lo para um estado que não poderia mais editar.
create policy clients_update on public.clients
for update to authenticated
using (app.is_boop() and app.has_client_access(id))
with check (app.is_boop() and app.has_client_access(id));

-- SEM policy de DELETE. A matriz tem `client.archive`, que é UPDATE de
-- `status`. Apagar cliente arrastaria projeto, conteúdo e histórico de
-- aprovação — não é operação de aplicação.

grant select, insert, update on public.clients to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- client_memberships — o vínculo que concede escopo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- É a tabela que decide quem alcança o quê. Escrever nela é conceder acesso,
-- então só `boop_admin` escreve — inclusive para si mesmo, o que é o teste de
-- self-grant.

create policy client_memberships_select on public.client_memberships
for select to authenticated
using (
  app.has_client_access(client_id)
  -- O cliente vê o próprio vínculo, não a lista de quem mais atende a conta.
  and (not app.is_client_user() or user_id = (select auth.uid()))
);

create policy client_memberships_insert on public.client_memberships
for insert to authenticated
with check (app.is_boop_admin());

-- SEM policy de UPDATE. Vínculo se concede e se revoga; não se edita. Sem
-- papel próprio na V0 (ADR-0005), não há o que alterar em uma linha existente
-- — e um UPDATE permitido seria o caminho para mover um vínculo de tenant.

create policy client_memberships_delete on public.client_memberships
for delete to authenticated
using (app.is_boop_admin());

grant select, insert, delete on public.client_memberships to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- projects
-- ═══════════════════════════════════════════════════════════════════════════

create policy projects_select on public.projects
for select to authenticated
using (app.has_client_access(client_id));

create policy projects_insert on public.projects
for insert to authenticated
with check (app.is_boop_admin() and app.has_client_access(client_id));

-- O WITH CHECK repete o USING de propósito: é ele que impede mover o projeto
-- para um cliente ao qual quem edita também tem acesso — o trigger de
-- imutabilidade já rejeita, e esta é a segunda fechadura.
create policy projects_update on public.projects
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

-- SEM policy de DELETE: `project.archive` é status (matriz).

grant select, insert, update on public.projects to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_stages — a jornada, sem client_id
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Não tem `client_id` e não vai ganhar um só para simplificar policy: o
-- escopo é o projeto, e `has_project_access` já resolve projeto -> cliente.

create policy project_stages_select on public.project_stages
for select to authenticated
using (app.has_project_access(project_id));

create policy project_stages_insert on public.project_stages
for insert to authenticated
with check (app.is_boop() and app.has_project_access(project_id));

create policy project_stages_update on public.project_stages
for update to authenticated
using (app.is_boop() and app.has_project_access(project_id))
with check (app.is_boop() and app.has_project_access(project_id));

create policy project_stages_delete on public.project_stages
for delete to authenticated
using (app.is_boop_admin() and app.has_project_access(project_id));

grant select, insert, update, delete on public.project_stages to authenticated;

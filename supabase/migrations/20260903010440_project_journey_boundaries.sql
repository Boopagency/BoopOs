-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 6 — FRONTEIRAS TRANSACIONAIS DE PROJETO E JORNADA (revisão da ADR-0011)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A ADR-0011 fixou cinco funções SQL na V0 e mandou reler antes de criar a
-- sexta. Esta migration cria a sexta, a sétima e a oitava, e o motivo é o
-- critério da própria ADR, não uma exceção a ele: são operações que tocam mais
-- de uma linha e que não podem ficar pela metade.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O que quebra sem transação, concretamente
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `supabase-js` não abre transação: cada chamada é uma transação própria.
--
--   createProject   insert em `projects` + insert em `project_stages`. Se o
--                   segundo falhar, sobra um projeto SEM JORNADA — que abre no
--                   portal, não responde "onde estamos" e não tem como avançar.
--                   A ADR-0006 define a jornada como materializada NA CRIAÇÃO;
--                   um projeto sem etapas não é um projeto pela metade, é um
--                   projeto que nunca deveria ter existido.
--
--   advanceStage    dois UPDATEs, e a ORDEM é obrigatória por causa do índice
--                   parcial `project_stages_one_current_idx`: a etapa corrente
--                   precisa sair de `current` antes de a próxima entrar. Se o
--                   segundo falhar, o projeto fica com ZERO etapa corrente —
--                   estado que nenhuma constraint proíbe, que a tela do cliente
--                   exibe como "nenhuma etapa em andamento", e que nada avisa.
--
--   setStageState   tornar uma etapa corrente exige tirar a anterior de
--                   corrente. Os mesmos dois UPDATEs, o mesmo índice, a mesma
--                   janela.
--
-- Nos três casos o modo de falha é silencioso e visível para o CLIENTE, que é
-- a pior combinação possível.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Por que `security definer`, e o que isso obriga
-- ─────────────────────────────────────────────────────────────────────────────
--
-- A primeira versão destas três funções era `security invoker` — a RLS
-- continuaria valendo dentro delas, e a função só acrescentaria a transação.
-- Era a escolha certa pelo princípio (`definer` só quando necessário) e **não
-- funciona neste schema**, por uma razão que vale registrar:
--
--   O bootstrap faz `revoke all on schema app from anon, authenticated`. As
--   funções de autorização — `app.is_boop_admin()`, `app.has_client_access()`,
--   `app.has_project_access()` — vivem lá justamente para não serem expostas
--   pelo PostgREST. Uma função `invoker` roda com os privilégios de quem
--   chama, e quem chama é `authenticated`: chamar `app.is_boop_admin()` de
--   dentro dela levanta `permission denied for schema app`.
--
--   As policies chamam as mesmas funções e funcionam porque expressão de
--   policy é avaliada com os privilégios do DONO da tabela, não os de quem
--   consulta. É por isso que a isolação do schema `app` nunca tinha esbarrado
--   em nada até aqui.
--
-- As saídas possíveis eram três, e duas são piores:
--
--   1. conceder `usage on schema app` a `authenticated` — desfaz uma decisão de
--      segurança da FASE 2 para conveniência de três funções. Recusada.
--   2. reescrever os predicados de autorização em SQL solto aqui dentro — cria
--      uma segunda verdade sobre escopo, competindo com a RLS. É exatamente o
--      que a ADR-0022 proíbe. Recusada.
--   3. `security definer`, como as quatro fronteiras que já existem.
--
-- A terceira é a escolhida, e o preço dela é explícito: **dentro destas funções
-- a RLS não é aplicada**, então toda checagem que a policy faria precisa estar
-- escrita no corpo. Está — e usando as MESMAS funções `app.*` que as policies
-- usam, não uma reimplementação:
--
--   | policy                  | predicado                                  | onde está aqui        |
--   | ----------------------- | ------------------------------------------ | --------------------- |
--   | `projects_insert`       | `is_boop_admin() and has_client_access()`  | create, linhas 2 e 3  |
--   | `project_stages_insert` | `is_boop() and has_project_access()`       | create, implicado (¹) |
--   | `project_stages_update` | `is_boop() and has_project_access()`       | advance/set, 2 e 3    |
--
--   (¹) as etapas são inseridas no projeto que a própria função acabou de criar
--       para um cliente já autorizado. Não há `project_id` vindo de fora para
--       conferir.
--
-- É a mesma forma das quatro anteriores: identidade de `(select auth.uid())` e
-- nunca de parâmetro, UMA transição por função, e o que dá para checar, checa.

-- ─────────────────────────────────────────────────────────────────────────────
-- Onde elas moram, e por quê
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Em `public`. `config.toml` expõe apenas `public` e `graphql_public`, e o
-- schema `app` tem `revoke all ... from anon, authenticated` desde o bootstrap:
-- uma função em `app` é invisível para o `rpc()` do cliente do servidor. É a
-- mesma razão pela qual `promote_invited_profile` e `record_activity` moram em
-- `public` (FASE 4).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O activity log entra na mesma transação
-- ─────────────────────────────────────────────────────────────────────────────
--
-- As três chamam `public.record_activity()`, que é `security definer` e resolve
-- `actor_id` a partir de `auth.uid()`. Estando dentro da mesma transação, a
-- mudança de domínio e o rastro dela ou acontecem juntos, ou não acontecem —
-- que é o que `docs/workflows.md` pede quando existe função SQL.
--
-- Por isso os workflows destas três operações NÃO chamam `ctx.activity()`: o
-- log já foi escrito aqui dentro, e chamar de novo produziria duas linhas para
-- um evento.

-- ═══════════════════════════════════════════════════════════════════════════
-- create_project_with_journey() — projeto e jornada nascem juntos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `p_stages` é a jornada já resolvida pela aplicação: um array JSON de
-- `{"key": ..., "label": ...}` NA ORDEM, vindo de `src/config/journeys.ts`.
--
-- O banco não conhece os templates, e isso é a ADR-0006 sendo respeitada: o
-- template vive em código, versionado e revisado em PR. Se o catálogo morasse
-- aqui, mudar uma jornada seria migration — exatamente o que a ADR recusou.
--
-- O que o banco garante é o que só ele pode garantir: que as duas escritas são
-- uma só, que `position` é contígua a partir de 1, e que a primeira etapa nasce
-- `current`.
--
-- A primeira etapa nascer `current` (e não todas `pending`) é decisão de
-- produto: a jornada existe para responder "onde estamos", e um projeto novo
-- que não responde nada já nasce devendo. `started_at` é carimbado junto.
create or replace function public.create_project_with_journey(
  p_client_id   uuid,
  p_name        text,
  p_type        public.project_type,
  p_journey_key text,
  p_stages      jsonb,
  p_starts_on   date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id   uuid := (select auth.uid());
  v_project_id uuid;
  v_count      int;
begin
  if v_actor_id is null then
    raise exception 'create_project_with_journey exige sessao' using errcode = '42501';
  end if;

  -- `project.create` é só do administrador (docs/permissions.md). `boop_member`
  -- não cria projeto nem no cliente em que tem vínculo — a linha da matriz é
  -- vazia, e vazio é decisão.
  if not app.is_boop_admin() then
    raise exception 'create_project_with_journey: apenas boop_admin' using errcode = '42501';
  end if;

  -- Redundante para `boop_admin`, que é global por D-08, e escrita assim mesmo:
  -- a função não deve depender de QUEM pode chamá-la hoje para estar correta.
  if not app.has_client_access(p_client_id) then
    raise exception 'create_project_with_journey: sem acesso ao cliente' using errcode = '42501';
  end if;

  if p_stages is null or jsonb_typeof(p_stages) <> 'array' or jsonb_array_length(p_stages) = 0 then
    raise exception 'create_project_with_journey: jornada vazia' using errcode = '22023';
  end if;

  insert into public.projects (client_id, name, type, journey_key, starts_on, created_by)
  values (p_client_id, p_name, p_type, p_journey_key, p_starts_on, v_actor_id)
  returning id into v_project_id;

  -- `with ordinality` é o que torna `position` contígua a partir de 1 sem a
  -- aplicação precisar mandar o número — e sem a chance de mandar errado.
  -- A primeira etapa é a única `current`; o índice parcial garante isso mesmo
  -- que este insert mude.
  insert into public.project_stages (project_id, stage_key, label, position, state, started_at)
  select
    v_project_id,
    stage.value ->> 'key',
    stage.value ->> 'label',
    stage.ordinality::int,
    case when stage.ordinality = 1 then 'current' else 'pending' end::public.stage_state,
    case when stage.ordinality = 1 then now() end
  from jsonb_array_elements(p_stages) with ordinality as stage(value, ordinality);

  get diagnostics v_count = row_count;

  -- Cinto e suspensório. A jornada que chegou tinha N etapas; se o banco não
  -- gravou N, alguma coisa entre as duas coisas não é o que se pensava — e um
  -- projeto com jornada incompleta é pior do que nenhum projeto. A exceção
  -- desfaz o insert de `projects` junto, que é a razão de tudo isto existir.
  if v_count <> jsonb_array_length(p_stages) then
    raise exception 'create_project_with_journey: jornada incompleta (% de %)',
      v_count, jsonb_array_length(p_stages) using errcode = '42501';
  end if;

  perform public.record_activity(
    'project.created',
    'project',
    v_project_id,
    p_client_id,
    v_project_id,
    jsonb_build_object('type', p_type::text, 'journey_key', p_journey_key, 'stages', v_count),
    'internal'
  );

  return v_project_id;
end;
$$;

comment on function public.create_project_with_journey(uuid, text, public.project_type, text, jsonb, date) is
  'Cria o projeto e materializa a jornada inteira em UMA transacao. A primeira '
  'etapa nasce current. O catalogo de templates vive em codigo (ADR-0006); '
  'esta funcao recebe as etapas ja resolvidas e garante a atomicidade (FASE 6).';

revoke all on function public.create_project_with_journey(uuid, text, public.project_type, text, jsonb, date) from public, anon;
grant execute on function public.create_project_with_journey(uuid, text, public.project_type, text, jsonb, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- advance_project_stage() — fecha a corrente, abre a próxima
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Três respostas possíveis, e nenhuma delas é "adivinhei":
--
--   'advanced'          havia corrente e havia próxima. O caso normal.
--   'journey_complete'  havia corrente e ela era a última. Fecha e para —
--                       zero etapa corrente é o estado legítimo de uma jornada
--                       terminada, e inventar uma nona etapa ou reabrir a
--                       primeira seria mentir sobre onde o projeto está.
--   'no_current'        não havia corrente e ainda há etapa por fazer.
--
-- O último caso é o mais importante: a função NÃO escolhe uma etapa. Escolher
-- "a primeira não concluída" criaria uma segunda fonte da verdade para "onde
-- estamos" — uma no `state = 'current'` e outra numa heurística —, e as duas
-- discordariam no primeiro caso estranho. O estado é corrigido explicitamente
-- por `set_project_stage_state()`, que é para isso que ela existe.
--
-- `project.status` não é tocado aqui. Status do projeto e etapa da jornada são
-- eixos independentes (docs/spec-review.md I-01): um projeto pode terminar a
-- jornada e continuar `active` enquanto o ciclo seguinte não abre.
create or replace function public.advance_project_stage(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id  uuid := (select auth.uid());
  v_client_id uuid;
  v_current   public.project_stages%rowtype;
  v_next      public.project_stages%rowtype;
  v_pending   int;
begin
  if v_actor_id is null then
    raise exception 'advance_project_stage exige sessao' using errcode = '42501';
  end if;

  -- A jornada é gerida pela Boop. `client_user` acompanha, não avança.
  if not app.is_boop() then
    raise exception 'advance_project_stage: apenas a Boop' using errcode = '42501';
  end if;

  if not app.has_project_access(p_project_id) then
    raise exception 'advance_project_stage: sem acesso ao projeto' using errcode = '42501';
  end if;

  select client_id into v_client_id from public.projects where id = p_project_id;

  if v_client_id is null then
    raise exception 'advance_project_stage: projeto inexistente' using errcode = '42501';
  end if;

  /*
   * `for update` na etapa corrente: dois avanços simultâneos no mesmo projeto
   * são a corrida real desta operação — duas abas abertas, dois cliques. Sem
   * o lock, os dois leriam a mesma corrente e os dois tentariam abrir a mesma
   * próxima; o segundo esbarraria no índice parcial e devolveria um erro de
   * unicidade, que não é o que aconteceu. Com o lock, o segundo espera, relê e
   * avança a partir do estado que o primeiro deixou.
   */
  select * into v_current
    from public.project_stages
   where project_id = p_project_id
     and state = 'current'
     for update;

  if not found then
    select count(*) into v_pending
      from public.project_stages
     where project_id = p_project_id
       and state = 'pending';

    if v_pending = 0 then
      return 'journey_complete';
    end if;

    return 'no_current';
  end if;

  select * into v_next
    from public.project_stages
   where project_id = p_project_id
     and state = 'pending'
     and position > v_current.position
   order by position
   limit 1
     for update;

  -- A ORDEM importa: a corrente sai de `current` ANTES de a próxima entrar. O
  -- índice parcial único não aceita as duas ao mesmo tempo, nem por um
  -- instante dentro da transação.
  update public.project_stages
     set state = 'done',
         completed_at = now()
   where id = v_current.id;

  if v_next.id is null then
    perform public.record_activity(
      'project.stage_changed', 'project_stage', v_current.id, v_client_id, p_project_id,
      jsonb_build_object(
        'from_stage', v_current.stage_key,
        'from_state', 'current',
        'to_state',   'done',
        'journey',    'complete'
      ),
      'internal'
    );

    return 'journey_complete';
  end if;

  update public.project_stages
     set state = 'current',
         started_at = coalesce(started_at, now())
   where id = v_next.id;

  perform public.record_activity(
    'project.stage_changed', 'project_stage', v_next.id, v_client_id, p_project_id,
    jsonb_build_object(
      'from_stage', v_current.stage_key,
      'to_stage',   v_next.stage_key,
      'to_state',   'current'
    ),
    'internal'
  );

  return 'advanced';
end;
$$;

comment on function public.advance_project_stage(uuid) is
  'Fecha a etapa corrente e abre a proxima, atomicamente. Ultima etapa conclui '
  'a jornada sem inventar proxima; sem etapa corrente devolve no_current e nao '
  'escolhe nenhuma. Nao toca project.status — sao eixos distintos (FASE 6).';

revoke all on function public.advance_project_stage(uuid) from public, anon;
grant execute on function public.advance_project_stage(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- set_project_stage_state() — a correção manual
-- ═══════════════════════════════════════════════════════════════════════════
--
-- É o que a ADR-0006 antecipou: "correção pontual (pular uma etapa, voltar)
-- existe via `setStageState`, sem precisar de editor".
--
-- A transação existe por causa de um caso: tornar uma etapa corrente exige
-- tirar a corrente anterior desse estado, e o índice parcial não aceita as duas
-- juntas. Os outros três estados tocam uma linha só, e passam pelo mesmo
-- caminho porque a autorização e o log são os mesmos — e porque duas portas
-- para a mesma operação é como uma delas fica sem uma checagem.
--
-- A etapa anterior vira `pending`, e não `done`. Concluir é `advanceStage`, que
-- carimba `completed_at`; aqui a corrente está sendo DESFEITA, não terminada, e
-- marcá-la como concluída inventaria um fato — que aquela etapa acabou — a
-- partir de um gesto que disse outra coisa.
--
-- O que a função NÃO faz: cascatear. Voltar para uma etapa anterior não reabre
-- as posteriores que já estavam `done`. Quem corrige decide etapa por etapa, e
-- o histórico não é reescrito por dedução.
create or replace function public.set_project_stage_state(
  p_project_id uuid,
  p_stage_id   uuid,
  p_state      public.stage_state
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id  uuid := (select auth.uid());
  v_client_id uuid;
  v_stage     public.project_stages%rowtype;
  v_previous  uuid;
begin
  if v_actor_id is null then
    raise exception 'set_project_stage_state exige sessao' using errcode = '42501';
  end if;

  if not app.is_boop() then
    raise exception 'set_project_stage_state: apenas a Boop' using errcode = '42501';
  end if;

  if not app.has_project_access(p_project_id) then
    raise exception 'set_project_stage_state: sem acesso ao projeto' using errcode = '42501';
  end if;

  select client_id into v_client_id from public.projects where id = p_project_id;

  if v_client_id is null then
    raise exception 'set_project_stage_state: projeto inexistente' using errcode = '42501';
  end if;

  /*
   * A etapa é buscada PELO PAR (id, project_id), não pelo id sozinho. O
   * `project_id` da URL já foi conferido acima; casar os dois impede agir sobre
   * a etapa de um projeto enquanto se afirma estar em outro — inclusive quando
   * os dois projetos são alcançáveis pelo mesmo ator.
   */
  select * into v_stage
    from public.project_stages
   where id = p_stage_id
     and project_id = p_project_id
     for update;

  if not found then
    raise exception 'set_project_stage_state: etapa nao pertence ao projeto' using errcode = '42501';
  end if;

  if v_stage.state = p_state then
    return 'unchanged';
  end if;

  if p_state = 'current' then
    -- Primeiro libera o índice parcial, depois ocupa. Nunca o contrário.
    update public.project_stages
       set state = 'pending',
           completed_at = null
     where project_id = p_project_id
       and state = 'current'
       and id <> p_stage_id
    returning id into v_previous;

    update public.project_stages
       set state = 'current',
           started_at = coalesce(started_at, now()),
           -- Uma etapa em andamento não tem data de conclusão. Deixar a antiga
           -- ali faria a tela dizer "em andamento · concluída em 12 de agosto".
           completed_at = null
     where id = p_stage_id;

  elsif p_state = 'done' then
    update public.project_stages
       set state = 'done',
           started_at   = coalesce(started_at, now()),
           completed_at = coalesce(completed_at, now())
     where id = p_stage_id;

  else
    -- `pending` e `skipped`: nenhuma das duas é uma etapa terminada, então a
    -- data de conclusão sai junto. O `check` da tabela só exige o inverso
    -- (`done` obriga `completed_at`), e uma etapa pulada com data de conclusão
    -- passaria pelo check dizendo uma coisa que não aconteceu.
    update public.project_stages
       set state = p_state,
           completed_at = null,
           started_at = case when p_state = 'pending' then null else started_at end
     where id = p_stage_id;
  end if;

  perform public.record_activity(
    'project.stage_changed', 'project_stage', p_stage_id, v_client_id, p_project_id,
    jsonb_build_object(
      'stage',      v_stage.stage_key,
      'from_state', v_stage.state::text,
      'to_state',   p_state::text,
      'correction', true
    ),
    'internal'
  );

  return 'updated';
end;
$$;

comment on function public.set_project_stage_state(uuid, uuid, public.stage_state) is
  'Correcao manual da jornada (pular, voltar, corrigir a etapa corrente). '
  'Tornar uma etapa current devolve a anterior para pending na MESMA transacao, '
  'preservando a invariante de uma corrente por projeto (FASE 6).';

revoke all on function public.set_project_stage_state(uuid, uuid, public.stage_state) from public, anon;
grant execute on function public.set_project_stage_state(uuid, uuid, public.stage_state) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- list_client_team() — as pessoas da Boop no projeto, para o portal
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Esta é a única `security definer` da migration, e ela é de LEITURA. Existe
-- porque a alternativa seria afrouxar duas policies.
--
-- A tela do projeto mostra "Quem está no projeto". A D-16 fechou que essa lista
-- vem de dado real — `client_memberships` cruzado com `profiles` — e não de
-- mock nem de cargo inventado. Só que um `client_user` não alcança nenhum dos
-- dois lados:
--
--   `client_memberships_select`  restringe o `client_user` ao PRÓPRIO vínculo
--                                (`user_id = auth.uid()`), de propósito: o
--                                cliente não vê a lista de quem mais atende a
--                                conta pela Data API.
--   `profiles_select`            via `has_profile_access`, nunca concede a um
--                                `client_user` a linha de outra pessoa.
--
-- As duas restrições estão certas e não vão mudar (§33 do escopo: RLS cuida de
-- TENANT). O que o produto pede é menos do que elas negam: não a lista de
-- vínculos, não os perfis — apenas os NOMES de quem atende a conta.
--
-- Então a função devolve exatamente isso: `full_name`, e nada mais. Sem id, sem
-- e-mail, sem papel, sem data do vínculo. O que não sai daqui não vaza no
-- payload do RSC, que é a mesma lógica da projeção da FASE 5 — a proteção real
-- é não buscar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Acesso não é alocação
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `boop_admin` alcança todos os clientes por D-08, e isso NÃO o coloca na
-- equipe de todos eles. O filtro é o vínculo EXPLÍCITO em `client_memberships`:
-- um admin sem vínculo com a conta não aparece, e um admin com vínculo aparece.
-- A tabela é a mesma para os dois papéis, e a diferença some — que é o certo,
-- porque quem o cliente vê é quem cuida da conta dele, não quem tem permissão
-- de olhar.
--
-- `client_user` nunca entra: a lista é da equipe da Boop, e mostrar pessoas do
-- próprio cliente ali confundiria as duas coisas.
create or replace function public.list_client_team(p_client_id uuid)
returns table (full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name
    from public.client_memberships m
    join public.profiles p on p.id = m.user_id
   where m.client_id = p_client_id
     -- Fail closed: sem acesso ao cliente, a consulta devolve zero linhas.
     -- A checagem fica DENTRO do predicado de propósito — uma função `sql` não
     -- tem onde levantar exceção, e zero linhas é a resposta certa mesmo: quem
     -- não alcança o cliente não deve distinguir "conta sem equipe" de "conta
     -- que não é sua" (docs/security.md).
     and app.has_client_access(p_client_id)
     and p.status = 'active'
     and p.role in ('boop_admin', 'boop_member')
   order by p.full_name nulls last;
$$;

comment on function public.list_client_team(uuid) is
  'Nomes das pessoas da Boop com vinculo EXPLICITO no cliente, para a tela do '
  'projeto. Devolve apenas full_name — sem id, e-mail ou papel. Acesso global '
  'de boop_admin (D-08) nao inclui ninguem na equipe: o vinculo e que inclui.';

revoke all on function public.list_client_team(uuid) from public, anon;
grant execute on function public.list_client_team(uuid) to authenticated;

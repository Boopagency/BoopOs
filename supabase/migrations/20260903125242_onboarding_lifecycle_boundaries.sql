-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 7 — O CICLO DE VIDA DA SUBMISSÃO PASSA A TER UMA PORTA SÓ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O que estava aberto
--
-- Até aqui `onboarding_submissions` tinha GRANT de INSERT e de UPDATE para
-- `authenticated`, com policies para acompanhar. A policy de UPDATE foi
-- escrita na FASE 4 com uma assimetria deliberada — `USING` trava o cliente em
-- `draft`, `WITH CHECK` não repete a trava — justamente para que o próprio
-- envio fosse possível por UPDATE direto.
--
-- Só que "enviar o onboarding" nunca foi uma escrita de uma linha: é status da
-- submissão + avanço de etapa + activity log, atomicamente
-- (docs/workflows.md#consistência-quando-usar-função-sql). Com o UPDATE
-- aberto, um `client_user` podia chamar o PostgREST direto e mover
-- `draft → submitted` **sem** a jornada e **sem** o log — e o sistema não teria
-- como saber que aquilo aconteceu.
--
-- Havia ainda um segundo caminho: com INSERT aberto, um `boop_member` podia
-- criar a submissão escolhendo o `template_id`, isto é, escolhendo QUAL
-- formulário o cliente responde, a partir de um id vindo do navegador.
--
-- ## A decisão
--
-- **Ciclo de vida é RPC. Nenhuma exceção, nem para a Boop.** Três funções
-- nomeadas passam a ser o único caminho de escrita, e a tabela fica com
-- `select` — como `strategy_approvals` e `content_approvals`, que a FASE 4 já
-- tinha deixado sem escrita pela API pela mesma razão.
--
-- Não é desconfiança do papel: é que duas portas para a mesma operação é como
-- uma delas fica sem uma checagem. Com uma porta só, autorização, transição de
-- estado, jornada e auditoria ficam no mesmo lugar, e uma tela nova não pode
-- esquecer nenhuma delas.
--
-- `onboarding_answers` NÃO muda: a resposta é escrita de uma linha, idempotente
-- por `unique (submission_id, question_id)`, e a RLS continua sendo a fronteira
-- principal dela. É o autosave, e ele acontece dezenas de vezes por sessão.
--
-- ## Por que `security definer`, e o que isso obriga
--
-- `authenticated` não tem `usage` no schema `app` (bootstrap), então uma função
-- `invoker` não conseguiria chamar `app.is_boop()`. O preço, sempre o mesmo: a
-- RLS **não** vale dentro do corpo, e toda checagem que uma policy faria está
-- escrita aqui à mão, com as mesmas funções `app.*`. É o que
-- `tests/rls/phase7-onboarding-boundaries.test.ts` cobra linha por linha.
--
-- Nenhuma delas aceita a identidade de quem chama por parâmetro: o ator é
-- sempre `(select auth.uid())` (ADR-0022).

-- ───────────────────────────────────────────────────────────────────────────
-- Fecha a escrita direta
-- ───────────────────────────────────────────────────────────────────────────
--
-- Policy e GRANT saem JUNTOS. Deixar a policy sem o grant deixaria a tabela
-- morta em silêncio, com o sintoma indistinguível de "a RLS negou"; deixar o
-- grant sem a policy é a porta com uma fechadura só. A varredura de
-- `tests/rls/policy-matrix.test.ts` afirma a igualdade das duas.
drop policy onboarding_submissions_insert on public.onboarding_submissions;
drop policy onboarding_submissions_update on public.onboarding_submissions;

revoke insert, update on public.onboarding_submissions from authenticated;

-- O SELECT continua exatamente como estava: quem alcança o cliente lê a
-- submissão. Ler nunca foi o problema.

-- ═══════════════════════════════════════════════════════════════════════════
-- start_onboarding() — a Boop abre o formulário
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entrada: `project_id`, e nada mais. Tudo o que pode ser derivado é derivado
-- aqui dentro — cliente, tipo do projeto e, sobretudo, TEMPLATE. Um
-- `template_id` vindo do navegador seria o cliente escolhendo qual formulário
-- responde; o caminho correto é o mesmo de `has_template_access`, sempre no
-- sentido projeto → tipo → template ativo.
--
-- Pré-condições, e o que cada uma responde:
--
--   sessão + `is_boop()`        `onboarding.start` é ✓/escopo/— na matriz: o
--                              cliente NÃO abre o próprio onboarding.
--   `has_project_access()`      escopo. O uuid da URL é endereço, não prova.
--   template ativo do tipo      `website`, `branding`, `automation` e `custom`
--                              não têm formulário na V0 — e isso é
--                              `unsupported`, não "ainda não abriram".
--   etapa corrente = onboarding a jornada é quem diz que chegou a hora. Sem
--                              isso, abrir cedo demais produziria o
--                              `submitted_no_advance` do D-21 no fluxo normal,
--                              quando ele existe para ser exceção.
--
-- Idempotência: o `on conflict do nothing` sobre `project_id unique` é o que
-- torna dois cliques em "Abrir onboarding" uma submissão só, inclusive quando
-- as duas transações passam juntas pela verificação de existência.
create or replace function public.start_onboarding(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id    uuid := (select auth.uid());
  v_client_id   uuid;
  v_type        public.project_type;
  v_template_id uuid;
  v_stage_key   text;
  v_submission  uuid;
begin
  if v_actor_id is null then
    raise exception 'start_onboarding exige sessao' using errcode = '42501';
  end if;

  if not app.is_boop() then
    raise exception 'start_onboarding: apenas a Boop abre o onboarding' using errcode = '42501';
  end if;

  if not app.has_project_access(p_project_id) then
    raise exception 'start_onboarding: sem acesso ao projeto' using errcode = '42501';
  end if;

  select p.client_id, p.type
    into v_client_id, v_type
    from public.projects p
   where p.id = p_project_id;

  if v_client_id is null then
    raise exception 'start_onboarding: projeto inexistente' using errcode = '42501';
  end if;

  -- Antes de qualquer pré-condição: se já existe, a resposta é "já está
  -- aberto". Recusar por causa da etapa um onboarding que JÁ foi aberto seria
  -- transformar idempotência em erro.
  select s.id into v_submission
    from public.onboarding_submissions s
   where s.project_id = p_project_id;

  if v_submission is not null then
    return 'already_started';
  end if;

  select t.id
    into v_template_id
    from public.onboarding_templates t
   where t.project_type = v_type
     and t.is_active
   order by t.version desc, t.key
   limit 1;

  if v_template_id is null then
    return 'unsupported';
  end if;

  select st.stage_key
    into v_stage_key
    from public.project_stages st
   where st.project_id = p_project_id
     and st.state = 'current';

  if v_stage_key is distinct from 'onboarding' then
    return 'stage_not_onboarding';
  end if;

  insert into public.onboarding_submissions (project_id, template_id, status, started_at)
  values (p_project_id, v_template_id, 'draft', now())
  on conflict (project_id) do nothing
  returning id into v_submission;

  if v_submission is null then
    return 'already_started';
  end if;

  perform public.record_activity(
    'onboarding.started', 'onboarding_submission', v_submission, v_client_id, p_project_id,
    jsonb_build_object('template_id', v_template_id),
    'internal'
  );

  return 'started';
end;
$$;

comment on function public.start_onboarding(uuid) is
  'Abre a submissao de onboarding de um projeto. So a Boop, so com a etapa '
  'onboarding corrente, so se houver template ativo para o tipo. O template e '
  'DERIVADO do projeto, nunca aceito por parametro. Idempotente.';

revoke all on function public.start_onboarding(uuid) from public, anon;
grant execute on function public.start_onboarding(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- submit_onboarding() — a fronteira transacional da fase
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Toca três coisas e não pode ficar pela metade: status da submissão, avanço
-- de etapa e activity log. É a nona função SQL da V0, já prevista em
-- docs/workflows.md desde a FASE 2.
--
-- ## D-21 — a jornada avança CONDICIONALMENTE
--
-- Se a etapa corrente é `onboarding`, ela fecha e a próxima abre: `advanced`.
-- Se é outra, a submissão é enviada e **a jornada não é tocada**:
-- `submitted_no_advance`.
--
-- A alternativa — forçar `immersion` — inventaria um fato a partir de um gesto
-- que disse outra coisa, exatamente o que `set_project_stage_state` se recusa
-- a fazer ("o histórico não é reescrito por dedução"). E o caso não é
-- hipotético: depois de um `reopen_onboarding` (D-22), o projeto já está em
-- `immersion`, e reenviar não pode empurrá-lo para `research`.
--
-- No fluxo normal esse ramo não acontece, porque `start_onboarding` só abre o
-- formulário com a etapa `onboarding` corrente. Ele é defesa, não caminho.
--
-- ## Duplo clique
--
-- `for update` na submissão, primeiro de tudo. A segunda transação espera,
-- relê a linha já `submitted` e devolve `already_submitted` — sucesso, não
-- erro (docs/workflows.md#idempotência). Sem esse lock, os dois cliques
-- avançariam a jornada duas vezes, e o cliente veria o projeto pular a
-- imersão.
--
-- A ORDEM dos dois UPDATEs de etapa é obrigatória, pela mesma razão da FASE 6:
-- `project_stages_one_current_idx` não aceita duas correntes nem por um
-- instante dentro da transação.
create or replace function public.submit_onboarding(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id  uuid := (select auth.uid());
  v_submission public.onboarding_submissions%rowtype;
  v_current    public.project_stages%rowtype;
  v_next       public.project_stages%rowtype;
  v_faltando   int;
  v_resultado  text;
  v_metadata   jsonb;
begin
  if v_actor_id is null then
    raise exception 'submit_onboarding exige sessao' using errcode = '42501';
  end if;

  -- `onboarding.submit` é ✓/escopo/escopo: as três personas enviam, dentro do
  -- escopo. Então a única pergunta de autorização é a de escopo — e ela vem
  -- antes de qualquer resposta que revele se este projeto tem onboarding.
  if not app.has_project_access(p_project_id) then
    raise exception 'submit_onboarding: sem acesso ao projeto' using errcode = '42501';
  end if;

  select * into v_submission
    from public.onboarding_submissions
   where project_id = p_project_id
     for update;

  if not found then
    return 'not_started';
  end if;

  if v_submission.status = 'submitted' then
    return 'already_submitted';
  end if;

  /*
   * Obrigatórias, no servidor. A validação do navegador é UX: ela evita a
   * viagem, não a fraude — e um POST direto no PostgREST não passa por ela.
   *
   * `app.answer_is_present` decide "vazio" por TIPO: `false` responde um
   * boolean, `0` responde um number, e os dois seriam recusados por qualquer
   * checagem de truthiness.
   */
  select count(*)
    into v_faltando
    from public.onboarding_questions q
    join public.onboarding_sections sec on sec.id = q.section_id
    left join public.onboarding_answers a
           on a.submission_id = v_submission.id
          and a.question_id = q.id
   where sec.template_id = v_submission.template_id
     and q.is_required
     and not app.answer_is_present(q.type, a.value);

  if v_faltando > 0 then
    return 'required_missing';
  end if;

  update public.onboarding_submissions
     set status       = 'submitted',
         submitted_at = now(),
         submitted_by = v_actor_id
   where id = v_submission.id;

  select * into v_current
    from public.project_stages
   where project_id = p_project_id
     and state = 'current'
     for update;

  if found and v_current.stage_key = 'onboarding' then
    select * into v_next
      from public.project_stages
     where project_id = p_project_id
       and state = 'pending'
       and position > v_current.position
     order by position
     limit 1
       for update;

    update public.project_stages
       set state = 'done',
           completed_at = now()
     where id = v_current.id;

    if v_next.id is not null then
      update public.project_stages
         set state = 'current',
             started_at = coalesce(started_at, now())
       where id = v_next.id;
    end if;

    v_resultado := 'advanced';
    v_metadata  := jsonb_build_object(
      'outcome', v_resultado,
      'from_stage', v_current.stage_key,
      'to_stage', v_next.stage_key
    );
  else
    v_resultado := 'submitted_no_advance';
    v_metadata  := jsonb_build_object(
      'outcome', v_resultado,
      'current_stage', v_current.stage_key
    );
  end if;

  /*
   * UMA linha, sempre — nunca duas para o mesmo envio. Por isso o workflow que
   * chama esta função não usa `ctx.activity()`.
   *
   * Metadata carrega identificadores e transições. NUNCA resposta: o log é
   * auditoria, e o conteúdo do onboarding é dado sensível de negócio
   * (.claude/rules/security.md).
   */
  perform public.record_activity(
    'onboarding.completed', 'onboarding_submission', v_submission.id,
    v_submission.client_id, p_project_id, v_metadata, 'internal'
  );

  return v_resultado;
end;
$$;

comment on function public.submit_onboarding(uuid) is
  'Envia o onboarding: status + avanco condicional da etapa + activity log, '
  'atomicamente. Avanca SO quando a etapa corrente e onboarding (D-21). '
  'Obrigatoria vazia recusa; duplo clique devolve already_submitted.';

revoke all on function public.submit_onboarding(uuid) from public, anon;
grant execute on function public.submit_onboarding(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- reopen_onboarding() — a saída para o erro de digitação
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sem ela, um cliente que enviou com um erro não tem recurso nenhum: nem ele,
-- que perdeu o direito de escrever (`app.can_answer_submission`), nem a Boop,
-- que não tem tela. O único conserto seria SQL manual em produção — que é
-- exatamente o que a definição de pronto do Marco 1 proíbe.
--
-- `boop_admin` apenas, como docs/workflows.md reserva.
--
-- ## O que ela NÃO faz
--
-- Não cria segunda submissão (`project_id` é unique, e o comentário da
-- migration original é explícito: reabrir usa esta função, não uma segunda
-- linha). Não cria versão. E **não mexe na jornada**: o projeto já andou, e
-- devolver `immersion` para `pending` reescreveria história que aconteceu.
--
-- Limpar `submitted_at` e `submitted_by` é seguro porque o envio anterior está
-- no `activity_log`, que é append-only: a ocorrência não se perde, ela só sai
-- do estado corrente da linha. É também por isso que `submitted_by` ficou de
-- fora do trigger de autoria imutável na FASE 5.
create or replace function public.reopen_onboarding(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id   uuid := (select auth.uid());
  v_submission public.onboarding_submissions%rowtype;
begin
  if v_actor_id is null then
    raise exception 'reopen_onboarding exige sessao' using errcode = '42501';
  end if;

  if not app.is_boop_admin() then
    raise exception 'reopen_onboarding: apenas um admin da Boop' using errcode = '42501';
  end if;

  -- `boop_admin` alcança todo cliente (D-08), então esta checagem é sempre
  -- verdadeira hoje. Ela fica porque a autorização não pode depender de um
  -- fato sobre OUTRA função: no dia em que o alcance do admin mudar, é aqui
  -- que a mudança precisa valer.
  if not app.has_project_access(p_project_id) then
    raise exception 'reopen_onboarding: sem acesso ao projeto' using errcode = '42501';
  end if;

  select * into v_submission
    from public.onboarding_submissions
   where project_id = p_project_id
     for update;

  if not found then
    return 'not_started';
  end if;

  if v_submission.status = 'draft' then
    return 'already_draft';
  end if;

  update public.onboarding_submissions
     set status       = 'draft',
         submitted_at = null,
         submitted_by = null
   where id = v_submission.id;

  perform public.record_activity(
    'onboarding.reopened', 'onboarding_submission', v_submission.id,
    v_submission.client_id, p_project_id,
    jsonb_build_object('previous_submitted_at', v_submission.submitted_at),
    'internal'
  );

  return 'reopened';
end;
$$;

comment on function public.reopen_onboarding(uuid) is
  'Devolve a submissao para draft, para o cliente corrigir. Apenas boop_admin. '
  'NAO mexe na jornada e NAO cria segunda submissao. Idempotente em draft.';

revoke all on function public.reopen_onboarding(uuid) from public, anon;
grant execute on function public.reopen_onboarding(uuid) to authenticated;

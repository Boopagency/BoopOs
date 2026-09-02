-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4 — FRONTEIRAS PRIVILEGIADAS (revisão da ADR-0021)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A FASE 3 deixou três escritas passando por `service_role`, com revisão
-- obrigatória nesta fase. Duas delas não podem virar policy — e o motivo é o
-- mesmo nas duas: a operação precisa de mais privilégio do que quem a executa
-- deveria ter em regime permanente.
--
--   `recordFirstLogin`  precisa escrever `profiles.status`, e conceder UPDATE
--                       de `profiles` a `authenticated` é conceder escalada de
--                       papel — `role` mora na mesma linha.
--
--   `logActivity`       precisa inserir em `activity_log`, e conceder INSERT
--                       ali permitiria forjar auditoria: linha com `actor_id`
--                       de outra pessoa, ou evento que nunca aconteceu.
--
-- A resposta não é manter `service_role`: é reduzir o privilégio ao tamanho
-- exato da operação. Estas duas funções são `security definer`, vivem em
-- `public` porque precisam ser chamáveis por `rpc` (só `public` e
-- `graphql_public` são expostos pelo PostgREST) e têm três propriedades:
--
--   1. a identidade vem de `(select auth.uid())`, NUNCA de parâmetro;
--   2. fazem UMA transição, não um UPDATE genérico;
--   3. o que dá para checar, checam — vínculo, estado de origem, autoria.
--
-- Com elas, `service_role` sai dos três pontos e a aplicação passa a falar com
-- o banco pelo JWT do usuário, com RLS valendo. Ver a ADR que substitui a 0021.

-- ═══════════════════════════════════════════════════════════════════════════
-- promote_invited_profile() — o primeiro login
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `invited -> active`, e nada mais. Não recebe `user_id`: opera sobre a linha
-- de quem está chamando, e só. Um parâmetro de identidade aqui transformaria
-- a função em "ative qualquer conta", que é exatamente o que ela não pode ser.
--
-- Idempotente pelo `where status = 'invited'`: reentrar dez vezes promove uma
-- vez e escreve um `user.joined`, não dez. É a mesma garantia que o
-- `recordFirstLogin` tinha via `eq('status','invited')`, agora dentro da
-- transação que também grava o log — então não existe janela em que a promoção
-- aconteça e o evento se perca.
--
-- Quem está `disabled` não casa com `invited` e não volta a ficar ativo por
-- clicar num link antigo.
create or replace function public.promote_invited_profile()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_status  public.profile_status;
begin
  if v_user_id is null then
    return 'no_session';
  end if;

  update public.profiles
     set status       = 'active',
         last_seen_at = now()
   where id = v_user_id
     and status = 'invited';

  if found then
    -- Dentro da mesma transação da promoção: ou as duas coisas acontecem, ou
    -- nenhuma. `actor_id` é o próprio usuário; `metadata` guarda a transição,
    -- nunca e-mail, nome ou token (.claude/rules/security.md).
    insert into public.activity_log (actor_id, entity_type, entity_id, action, metadata, visibility)
    values (
      v_user_id,
      'profile',
      v_user_id,
      'user.joined',
      jsonb_build_object('status_from', 'invited', 'status_to', 'active'),
      'internal'
    );

    return 'promoted';
  end if;

  select p.status into v_status from public.profiles p where p.id = v_user_id;

  if v_status is null then
    -- Sessão válida sem espelho em `profiles`: estado inconsistente, nunca
    -- usuário novo. Ninguém ganha perfil aqui.
    return 'no_profile';
  end if;

  if v_status <> 'active' then
    return 'disabled';
  end if;

  update public.profiles set last_seen_at = now() where id = v_user_id;

  return 'already_active';
end;
$$;

comment on function public.promote_invited_profile() is
  'Primeiro login: invited -> active + user.joined, na mesma transacao. '
  'Opera SOMENTE sobre auth.uid(); nao aceita identidade por parametro. '
  'Substitui o uso de service_role de recordFirstLogin (ADR-0021).';

-- `revoke from public` NAO basta: o Supabase mantem um default privilege que
-- concede EXECUTE em funcoes de `public` a `anon`, `authenticated` e
-- `service_role`, e um grant explicito sobrevive ao revoke de `public`. Sem a
-- linha de `anon` abaixo, uma sessao anonima poderia chamar a funcao — hoje
-- ela devolveria `no_session` e nada mais, mas conceder execucao a quem nao
-- tem sessao e privilegio sem uso, e privilegio sem uso e o que sobra quando
-- a funcao muda.
revoke all on function public.promote_invited_profile() from public, anon;
grant execute on function public.promote_invited_profile() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- record_activity() — o único caminho de escrita do log
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `actor_id` NÃO é parâmetro. É `(select auth.uid())`, sempre. Essa é a
-- diferença entre um log de auditoria e um campo de texto: se quem chama
-- escolhesse o autor, a linha não provaria nada.
--
-- `client_id` e `project_id` são parâmetros, e por isso são conferidos: quem
-- não alcança o cliente não escreve linha atribuída a ele. Sem essa checagem,
-- um usuário poderia poluir a auditoria de outro tenant.
--
-- A tabela é append-only por trigger (ADR-0012/0019). Esta função só insere —
-- e nem poderia fazer diferente: o trigger rejeita UPDATE e DELETE inclusive
-- para `service_role`.
create or replace function public.record_activity(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid    default null,
  p_client_id   uuid    default null,
  p_project_id  uuid    default null,
  p_metadata    jsonb   default '{}'::jsonb,
  p_visibility  public.activity_visibility default 'internal'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null then
    raise exception 'record_activity exige sessao' using errcode = '42501';
  end if;

  -- Atribuir evento a um tenant que não se alcança é forjar auditoria.
  if p_client_id is not null and not app.has_client_access(p_client_id) then
    raise exception 'record_activity: sem acesso ao cliente' using errcode = '42501';
  end if;

  if p_project_id is not null and not app.has_project_access(p_project_id) then
    raise exception 'record_activity: sem acesso ao projeto' using errcode = '42501';
  end if;

  insert into public.activity_log (
    actor_id, client_id, project_id, entity_type, entity_id, action, metadata, visibility
  )
  values (
    v_actor_id,
    p_client_id,
    p_project_id,
    p_entity_type,
    p_entity_id,
    p_action,
    coalesce(p_metadata, '{}'::jsonb),
    p_visibility
  );
end;
$$;

comment on function public.record_activity(text, text, uuid, uuid, uuid, jsonb, public.activity_visibility) is
  'Escrita do activity log pelo JWT do usuario. actor_id vem de auth.uid(), '
  'nunca de parametro; client_id/project_id sao conferidos contra o vinculo. '
  'Substitui o uso de service_role de logActivity (ADR-0021).';

revoke all on function public.record_activity(text, text, uuid, uuid, uuid, jsonb, public.activity_visibility) from public, anon;
grant execute on function public.record_activity(text, text, uuid, uuid, uuid, jsonb, public.activity_visibility) to authenticated;

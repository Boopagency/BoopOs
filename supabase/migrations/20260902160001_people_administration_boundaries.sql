-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 5 — FRONTEIRAS DE ADMINISTRAÇÃO DE PESSOAS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A ADR-0022 fechou a FASE 4 com um gatilho de revisão explícito:
--
--   "uma operação de administração de pessoas (FASE 5) que exija escrever
--    `profiles` fora da promoção. Nos dois casos: fronteira nova, nomeada e
--    testada — nunca um GRANT que sirva para mais do que o caso pediu."
--
-- É exatamente o que chegou. A FASE 5 precisa de duas escritas em `profiles`:
--
--   `inviteUser`   define o papel de quem acabou de ser convidado — o trigger
--                  `app.handle_new_auth_user()` cria a linha com o default
--                  `client_user`, e convidar um `boop_member` precisa mudá-lo;
--
--   `disableUser`  move `status` para `disabled`.
--
-- `profiles` continua SEM policy e SEM GRANT de UPDATE, e continua pelo mesmo
-- motivo da FASE 4: `role` e `status` moram na mesma linha, então qualquer
-- UPDATE concedido a `authenticated` é escalada de privilégio a uma linha de
-- SQL de distância. A resposta é a da ADR-0022 — reduzir o privilégio ao
-- tamanho da operação, não conceder o genérico.
--
-- As duas funções abaixo repetem as três propriedades das fronteiras da FASE 4:
--
--   1. quem chama é `(select auth.uid())`, conferido por `app.is_boop_admin()`
--      DENTRO da função — o parâmetro diz sobre QUEM se opera, nunca QUEM opera;
--   2. cada uma faz UMA transição, com o estado de origem no `where`;
--   3. o que dá para checar, checam — papel de quem chama, estado do alvo, e a
--      identidade do alvo contra a de quem chama.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Por que nenhuma delas aceita `boop_admin` como alvo ou como valor
-- ─────────────────────────────────────────────────────────────────────────────
--
-- A matriz de `docs/permissions.md` tem duas linhas de convite —
-- `user.invite_client_user` e `user.invite_boop_member` — e **não tem** uma
-- terceira para `boop_admin`. A ausência é decisão: criar administrador é
-- provisionamento, não operação de produto, e sai por
-- `scripts/auth/provision-user.sh` com a chave de serviço na mão de uma pessoa.
--
-- Deixar `boop_admin` passar aqui transformaria a tela de convite em uma
-- fábrica de administradores — e como `boop_admin` é global por D-08, seria a
-- escalada mais barata do sistema. O `check` no corpo é essa decisão, escrita.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Por que o alvo nunca pode ser quem chama
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `p_user_id = auth.uid()` é rejeitado nas duas. Em `disable_profile` isso
-- evita o auto-desligamento — que, com um só administrador, é a porta trancada
-- por dentro e sem chave: `profiles` não tem caminho de volta pela aplicação
-- (ver a dívida registrada em docs/security.md).
--
-- Em `assign_invited_profile_role` a proteção é redundante — quem chama é
-- `boop_admin` e o alvo precisa estar `invited`, e as duas coisas não coexistem
-- na mesma linha —, e existe assim mesmo: uma invariante que só vale por
-- coincidência de outra regra deixa de valer quando a outra muda.

-- ═══════════════════════════════════════════════════════════════════════════
-- assign_invited_profile_role() — o papel de quem foi convidado
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Só atinge quem está `invited`, isto é: quem ainda não entrou nenhuma vez.
-- Depois do primeiro login o perfil vira `active` e sai do alcance desta
-- função — trocar o papel de alguém que já trabalha no sistema não está na
-- matriz, e por isso não tem caminho.
--
-- Idempotente pelo próprio UPDATE: reatribuir o mesmo papel escreve a mesma
-- linha e devolve 'assigned'. Convidar duas vezes não quebra.
create or replace function public.assign_invited_profile_role(
  p_user_id uuid,
  p_role    public.user_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_status public.profile_status;
begin
  if v_caller is null then
    raise exception 'assign_invited_profile_role exige sessao' using errcode = '42501';
  end if;

  -- `user.invite_*` é do administrador. `boop_member` não convida (matriz).
  if not app.is_boop_admin() then
    raise exception 'assign_invited_profile_role: apenas boop_admin' using errcode = '42501';
  end if;

  if p_user_id = v_caller then
    raise exception 'assign_invited_profile_role: alvo nao pode ser quem chama'
      using errcode = '42501';
  end if;

  -- A ausência da terceira linha da matriz, aplicada.
  if p_role = 'boop_admin' then
    raise exception 'assign_invited_profile_role: boop_admin nao se cria por convite'
      using errcode = '42501';
  end if;

  update public.profiles
     set role = p_role
   where id = p_user_id
     and status = 'invited'
  returning status into v_status;

  if v_status is null then
    -- Já ativo, desligado ou inexistente. Os três devolvem o mesmo texto: a
    -- função não é um oráculo sobre quem existe (docs/security.md).
    return 'not_invited';
  end if;

  return 'assigned';
end;
$$;

comment on function public.assign_invited_profile_role(uuid, public.user_role) is
  'Define o papel de um perfil ainda `invited`. Exige boop_admin, recusa '
  'boop_admin como valor e recusa o proprio chamador como alvo (FASE 5).';

revoke all on function public.assign_invited_profile_role(uuid, public.user_role) from public, anon;
grant execute on function public.assign_invited_profile_role(uuid, public.user_role) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- disable_profile() — o desligamento
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `active | invited -> disabled`. Vale para os dois estados de origem de
-- propósito: revogar um convite que não devia ter saído é tão necessário
-- quanto desligar quem já entrou, e são o mesmo gesto para quem administra.
--
-- O efeito é imediato no request seguinte, sem esperar o JWT expirar:
-- `requireActor()` derruba quem não está `active`, e `app.actor_role()`
-- devolve null no banco — as duas camadas concordam (docs/authorization.md).
--
-- Idempotente pelo `where status <> 'disabled'`: desligar duas vezes escreve
-- uma vez e devolve 'already_disabled' na segunda.
create or replace function public.disable_profile(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := (select auth.uid());
  v_updated uuid;
begin
  if v_caller is null then
    raise exception 'disable_profile exige sessao' using errcode = '42501';
  end if;

  if not app.is_boop_admin() then
    raise exception 'disable_profile: apenas boop_admin' using errcode = '42501';
  end if;

  -- Sem caminho de volta pela aplicação, auto-desligar é trancar a porta por
  -- dentro. Com um único administrador, ninguém reabre.
  if p_user_id = v_caller then
    raise exception 'disable_profile: nao e possivel desligar a si mesmo'
      using errcode = '42501';
  end if;

  update public.profiles
     set status = 'disabled'
   where id = p_user_id
     and status <> 'disabled'
  returning id into v_updated;

  if v_updated is null then
    return case
      when exists (select 1 from public.profiles where id = p_user_id)
        then 'already_disabled'
      else 'not_found'
    end;
  end if;

  return 'disabled';
end;
$$;

comment on function public.disable_profile(uuid) is
  'Move um perfil para `disabled`. Exige boop_admin e recusa o proprio '
  'chamador. Idempotente. Nao existe caminho de volta na V0 (FASE 5).';

revoke all on function public.disable_profile(uuid) from public, anon;
grant execute on function public.disable_profile(uuid) to authenticated;

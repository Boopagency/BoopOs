-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — BASELINE DE NEGAÇÃO. AS POLÍTICAS SÃO DA FASE 4.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  LEIA ANTES DE CONCLUIR QUALQUER COISA SOBRE SEGURANÇA:
--
--     Esta migration NÃO torna o banco multi-tenant seguro.
--
-- O que ela faz: liga RLS em todas as tabelas e NÃO cria nenhuma policy.
-- Em Postgres, RLS ligada sem policy significa negar tudo. Então o estado
-- desta fase é "ninguém autenticado lê nada", que é o baseline seguro para
-- um banco que ainda não tem autorização escrita.
--
-- O que ela NÃO faz: as políticas de SELECT/INSERT/UPDATE/DELETE, as funções
-- `app.has_client_access()` e companhia, e a suíte de isolamento que prova que
-- o Cliente A não alcança o Cliente B. Tudo isso é a FASE 4
-- (docs/security.md, ADR-0004).
--
-- Enquanto isso não existir, o acesso ao banco acontece só por `service_role`
-- no servidor — que ignora RLS por definição e por isso vive confinada em
-- `src/lib/supabase/admin.ts`.
--
-- Além da RLS, revogamos explicitamente os privilégios de `anon` e
-- `authenticated`. São duas fechaduras: mesmo que alguém desligue a RLS por
-- engano numa migration futura, ainda não há GRANT. A FASE 4 concede
-- privilégio e escreve a policy no mesmo lugar, para que nunca exista um sem
-- o outro.

do $$
declare
  v_table text;
  v_tables constant text[] := array[
    'profiles',
    'clients',
    'client_memberships',
    'projects',
    'project_stages',
    'onboarding_templates',
    'onboarding_sections',
    'onboarding_questions',
    'onboarding_submissions',
    'onboarding_answers',
    'strategies',
    'strategy_versions',
    'strategy_approvals',
    'content_items',
    'content_versions',
    'content_comments',
    'content_approvals',
    'activity_log',
    'notifications'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on public.%I from anon, authenticated', v_table);
  end loop;
end;
$$;

-- Sequência do activity_log: sem privilégio para os papéis do browser.
revoke all on all sequences in schema public from anon, authenticated;

comment on schema public is
  'Tabelas de dominio. RLS habilitada em todas; as POLICIES chegam na FASE 4. '
  'Ate la o acesso e exclusivamente server-side via service_role.';

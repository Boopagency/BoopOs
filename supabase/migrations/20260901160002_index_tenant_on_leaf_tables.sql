-- ═══════════════════════════════════════════════════════════════════════════
-- Índice de `client_id` nas três tabelas que ficaram sem ele
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O linter de performance do Supabase apontou 21 chaves estrangeiras sem
-- índice de cobertura. A maioria é ruído nesta fase: `created_by`,
-- `decided_by`, `author_id`, `submitted_by` só pesam quando se APAGA um perfil,
-- e perfil aqui não é apagado — é desabilitado. Criar oito índices para um
-- caminho que não roda é exatamente o excesso que docs/spec-review.md §4 manda
-- evitar.
--
-- Três, porém, não são ruído. `content_comments`, `content_approvals` e
-- `strategy_approvals` guardam `client_id` e ficaram sem índice, enquanto as
-- irmãs (`content_items`, `content_versions`, `strategies`,
-- `strategy_versions`, `onboarding_submissions`) têm o seu. Isso importa agora
-- porque a FASE 4 vai filtrar TODA leitura por `client_id` na policy: sem
-- índice, cada consulta do portal vira varredura sequencial. Policy de RLS é
-- caminho de leitura real — talvez o mais real de todos.
create index content_comments_client_idx    on public.content_comments (client_id);
create index content_approvals_client_idx   on public.content_approvals (client_id);
create index strategy_approvals_client_idx  on public.strategy_approvals (client_id);

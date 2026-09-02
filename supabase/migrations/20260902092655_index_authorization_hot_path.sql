-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 4 — ÍNDICE DO CAMINHO QUENTE DA AUTORIZAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Um índice só, e ele foi medido — não adivinhado.
--
-- `app.has_template_access()` responde ao escopo das TRÊS tabelas de catálogo
-- (`onboarding_templates`, `_sections`, `_questions`) e faz sempre a mesma
-- pergunta:
--
--     select 1 from public.onboarding_submissions where template_id = $1
--
-- `template_id` é FK e não tinha índice. O `explain` local confirmava o que o
-- linter do Supabase apontou em staging (`unindexed_foreign_keys`):
--
--     Seq Scan on onboarding_submissions s
--       Filter: (template_id = '…'::uuid)
--
-- Numa policy isso é caro de um jeito específico: o predicado é avaliado por
-- linha de catálogo lida, e a tabela de submissões cresce com o número de
-- projetos. Duas coisas que crescem, multiplicando.
--
-- O que NÃO entrou aqui, e por quê:
--
--   • `client_memberships` — o caminho mais quente de todos (`has_client_access`
--     roda em quase toda policy) já está coberto por
--     `client_memberships_user_client_idx (user_id, client_id)` e pelo unique
--     `(client_id, user_id)`. O `explain` do self-join de `has_profile_access`
--     usa os dois lados por índice. Nada a fazer.
--
--   • Os outros dezessete `unindexed_foreign_keys` do linter — são `created_by`,
--     `decided_by`, `author_id`, `submitted_by` e afins. Nenhum está em
--     predicado de policy: servem a join de exibição, que ainda não existe.
--     Índice especulativo custa escrita e não paga leitura que ninguém faz.
--
--   • Os vinte e cinco `unused_index` — "nunca usado" num staging sem tráfego
--     não é sinal de nada. Derrubar índice com base em banco ocioso é como
--     apagar teste que nunca falhou.

create index if not exists onboarding_submissions_template_idx
  on public.onboarding_submissions (template_id);

comment on index public.onboarding_submissions_template_idx is
  'Caminho de app.has_template_access(): o escopo do catalogo de onboarding '
  'atravessa submissao -> template. Sem ele a policy faz seq scan.';

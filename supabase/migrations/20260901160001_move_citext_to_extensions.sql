-- ═══════════════════════════════════════════════════════════════════════════
-- citext sai de `public` e vai para `extensions`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Achado do linter do Supabase depois de aplicar a FASE 2 no staging:
-- `extension_in_public` (WARN). Extensão instalada em `public` publica as
-- funções dela na superfície da API — no caso do citext, uma dúzia de funções
-- de comparação que ninguém precisa expor. A convenção do Supabase é manter
-- extensão no schema `extensions`, que já existe lá e já tem `usage` para os
-- papéis da API.
--
-- Por que migration nova em vez de corrigir a 20260901140001: migrations aqui
-- são forward-only e a 140001 já foi aplicada no staging
-- (.claude/rules/database.md). Reescrever história de migration para arrumar
-- um WARN é trocar um problema pequeno por um grande.
--
-- O tipo se move junto com as colunas que o usam: `profiles.email`,
-- `clients.slug`, `onboarding_templates.key` e `notifications.recipient_email`
-- continuam citext, agora qualificado como `extensions.citext`.
--
-- DAQUI PARA A FRENTE: coluna citext nova se escreve `extensions.citext`.

-- No Supabase hospedado este schema já existe. Localmente, sem Docker, não —
-- e a migration precisa rodar nos dois.
create schema if not exists extensions;

-- `usage` no schema é pré-requisito para USAR O TIPO, não para ler tabela.
-- Sem isto, na FASE 4 um `select email from profiles` falharia por causa do
-- tipo da coluna, e não por causa da policy — erro que custaria uma tarde.
grant usage on schema extensions to postgres, anon, authenticated, service_role;

alter extension citext set schema extensions;

comment on schema extensions is
  'Extensoes. Fora de public para nao expor funcao de extensao na API.';

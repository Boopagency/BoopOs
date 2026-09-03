-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 6 — A JORNADA DE UM PROJETO NÃO MUDA DEPOIS DE MATERIALIZADA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A ADR-0006 declara `journey_key` imutável, com uma consequência escrita:
-- "projeto existente não é afetado por mudança de template: já tem as etapas
-- materializadas e o `journey_key` com que nasceu".
--
-- O banco não garantia isso. `projects_update` concede UPDATE da linha inteira
-- a quem é da Boop e alcança o cliente, e a policy decide LINHA, nunca COLUNA —
-- é o mesmo achado que a FASE 5 corrigiu em `created_at` e `created_by`
-- (`20260902165421_immutable_authorship.sql`), aplicado à coluna que amarra o
-- projeto à sua jornada.
--
--   update public.projects set journey_key = 'website.v1' where id = ...
--
-- O efeito de deixar isso passar não é vazamento entre tenants: é incoerência
-- permanente. As oito linhas de `project_stages` continuariam sendo as de
-- `social.v1`, e o projeto passaria a dizer que nasceu de outro template. O
-- `summary` de cada etapa, que é lido do template em tempo de leitura
-- (`src/config/journeys.ts`), sairia em branco para o cliente — a jornada
-- perderia o texto sem que nada tivesse falhado.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Por que `type` entra junto
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `journey_key` é derivado de `type` na criação (`JOURNEY_BY_TYPE`), e é a
-- única coisa que mantém as duas colunas coerentes. Congelar só uma das duas
-- deixaria a porta aberta pelo outro lado:
--
--   type = 'website'  +  journey_key = 'social.v1'
--
-- que é um projeto de site com jornada de social — a contradição que a
-- imutabilidade de `journey_key` existia para impedir, alcançada por outro
-- caminho. As duas colunas descrevem a MESMA decisão, tomada uma vez, na
-- criação; então ou as duas são imutáveis, ou nenhuma é.
--
-- A regra conservadora tem preço, e ele está registrado: corrigir o tipo de um
-- projeto exige criar o certo e arquivar o outro, como já acontece com
-- `clients.slug` (D-15). Trocar o tipo preservando o histórico exigiria uma
-- migração de jornada — rematerializar etapas, decidir o que fazer com as já
-- concluídas — e isso é desenho próprio, não efeito colateral de um UPDATE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger novo, e não edição do que existe
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `projects_immutable_tenant` já cobre `client_id` e permanece exatamente como
-- está: migrations são forward-only, e recriar um trigger aplicado em staging
-- para acrescentar duas colunas trocaria uma garantia em vigor por uma janela
-- em que ela não existe. Dois triggers BEFORE UPDATE na mesma tabela rodam os
-- dois, e qualquer um deles que levante aborta a transação.
--
-- `app.enforce_immutable_columns()` é a mesma função da FASE 2, e levanta
-- `23514` — o mesmo código das outras imutabilidades, então quem trata o erro
-- não precisa aprender um caso novo.

create trigger projects_immutable_journey
  before update on public.projects
  for each row execute function app.enforce_immutable_columns('journey_key', 'type');

comment on trigger projects_immutable_journey on public.projects is
  'ADR-0006 aplicada pelo banco: journey_key e type sao decididos na criacao e '
  'nao mudam. As etapas ja materializadas nao podem discordar da chave que as '
  'gerou (FASE 6).';

-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 5 — AUTORIA E DATA DE CRIAÇÃO SÃO IMUTÁVEIS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Achado durante a validação hospedada da FASE 5, e corrigido aqui.
--
-- ## O que estava aberto
--
-- `authenticated` tem GRANT de UPDATE nas tabelas de domínio, e a policy decide
-- QUAIS LINHAS podem ser escritas — nunca QUAIS COLUNAS. `clients_update` diz
-- `is_boop() and has_client_access(id)`, e isso é tudo: quem passa por ela
-- reescreve qualquer coluna da linha, `created_at` e `created_by` incluídos.
--
-- Reproduzido contra o staging, pelo papel `authenticated`, com a identidade
-- de um `boop_admin` real:
--
--   update public.clients set created_at = '2000-01-01' → 1 linha
--   update public.clients set created_by = null         → 1 linha
--
-- A aplicação nunca faz isso: `updateClientSchema` é `.strict()` e o objeto de
-- UPDATE lista `name` e `notes` por extenso. Mas a Data API é pública, e a
-- regra do repositório é que a aplicação não é a última fechadura.
--
-- ## Por que isso importa, e o quanto
--
-- Não é isolamento entre tenants e não é escalada de privilégio: quem
-- consegue já alcançava a linha. É **integridade de auditoria** — falsificar
-- quem criou uma conta e quando. Num sistema cujo valor está em registrar
-- decisões, um `created_by` que aceita ser reescrito vale menos que nenhum.
--
-- Severidade média, alcance amplo: a varredura encontrou 12 tabelas.
--
-- ## Por que a correção não para em `clients`
--
-- `clients` foi onde tropeçamos, porque é a única tabela que a FASE 5 escreve.
-- Mas o GRANT de UPDATE das outras onze já existe desde a FASE 4 — elas estão
-- vazias, não protegidas. Corrigir uma das doze ocorrências do mesmo achado
-- seria deixar onze buracos abertos de propósito, e cada fase seguinte teria de
-- lembrar de fechar o seu.
--
-- Não é antecipar a FASE 6: nenhuma feature, query ou workflow entra aqui. É
-- DDL defensiva sobre tabelas que já existem.
--
-- ## Duas regras, porque há dois comportamentos legítimos
--
-- `created_at` é estrito: nada o altera, nunca.
--
-- `created_by` e `author_id` NÃO podem ser estritos, e isso só apareceu quando
-- a suíte da FASE 2 quebrou. As FKs de autoria são `on delete set null` de
-- propósito: apagar uma pessoa não pode destruir o cliente que ela criou, então
-- o schema QUER que a coluna vire nula nesse momento (ADR-0019). Um trigger
-- estrito ali tornaria impossível apagar qualquer pessoa que já tenha criado
-- alguma coisa — e trocaria o erro `23503` que a FASE 2 afirma por um `23514`
-- de outra causa.
--
-- A regra certa é mais precisa do que "imutável": autoria pode ser **limpa**,
-- nunca **reatribuída**. `alguém -> null` é o cascade; `alguém -> outra pessoa`
-- e `null -> alguém` são falsificação, e são o que se quer barrar.
--
-- ## O que fica de fora, e por quê
--
-- `onboarding_submissions.submitted_by` **não** entra. Ele nasce nulo e é
-- preenchido no UPDATE que submete o onboarding (FASE 7) — travá-lo quebraria
-- o fluxo antes de ele existir. Autoria que se define no meio da vida da linha
-- não é a mesma coisa que autoria de criação.
--
-- `activity_log` também não: ela é append-only por trigger, sem UPDATE para
-- ninguém, inclusive `service_role` (ADR-0012/0019). Trigger de imutabilidade
-- ali seria uma segunda tranca na porta que já está soldada.
--
-- ## Trigger separado, e não os da FASE 2 reescritos
--
-- As tabelas de domínio já têm `*_immutable_tenant`, que protege `client_id` e
-- `project_id`. Podia-se acrescentar as colunas de autoria àqueles triggers;
-- ficam separados de propósito. São duas invariantes com dois motivos —
-- multi-tenancy e auditoria — e no catálogo do Postgres cada uma diz o próprio
-- nome. Quando uma delas mudar, a outra não entra junto por acidente.

-- ═══════════════════════════════════════════════════════════════════════════
-- A regra da autoria: pode ser limpa, nunca reatribuída
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function app.enforce_authorship_not_reassigned()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text;
  v_old    uuid;
  v_new    uuid;
begin
  foreach v_column in array tg_argv loop
    execute format('select ($1).%I', v_column) into v_old using old;
    execute format('select ($1).%I', v_column) into v_new using new;

    if v_old is distinct from v_new then
      -- `alguem -> null` e o `on delete set null` da FK. Passa.
      if v_new is null then
        continue;
      end if;

      -- Todo o resto e falsificacao de autoria: reatribuir a outra pessoa, ou
      -- inventar um autor onde nao havia.
      raise exception '%.% nao pode ser reatribuida (tentou % -> %)',
        tg_table_name, v_column, coalesce(v_old::text, 'null'), v_new::text
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

comment on function app.enforce_authorship_not_reassigned() is
  'BEFORE UPDATE: autoria pode ser limpa (on delete set null da FK), nunca '
  'reatribuida a outra pessoa. Ver docs/security.md (FASE 5).';

create trigger clients_immutable_authorship
  before update on public.clients
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger clients_authorship_not_reassigned
  before update on public.clients
  for each row execute function app.enforce_authorship_not_reassigned('created_by');

create trigger projects_immutable_authorship
  before update on public.projects
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger projects_authorship_not_reassigned
  before update on public.projects
  for each row execute function app.enforce_authorship_not_reassigned('created_by');

create trigger project_stages_immutable_authorship
  before update on public.project_stages
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger onboarding_templates_immutable_authorship
  before update on public.onboarding_templates
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger onboarding_sections_immutable_authorship
  before update on public.onboarding_sections
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger onboarding_questions_immutable_authorship
  before update on public.onboarding_questions
  for each row execute function app.enforce_immutable_columns('created_at');

-- `submitted_by` fora: preenchido no UPDATE do submit (FASE 7).
create trigger onboarding_submissions_immutable_authorship
  before update on public.onboarding_submissions
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger onboarding_answers_immutable_authorship
  before update on public.onboarding_answers
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger strategies_immutable_authorship
  before update on public.strategies
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger strategy_versions_immutable_authorship
  before update on public.strategy_versions
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger strategy_versions_authorship_not_reassigned
  before update on public.strategy_versions
  for each row execute function app.enforce_authorship_not_reassigned('created_by');

create trigger content_items_immutable_authorship
  before update on public.content_items
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger content_items_authorship_not_reassigned
  before update on public.content_items
  for each row execute function app.enforce_authorship_not_reassigned('created_by');

create trigger content_versions_immutable_authorship
  before update on public.content_versions
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger content_versions_authorship_not_reassigned
  before update on public.content_versions
  for each row execute function app.enforce_authorship_not_reassigned('created_by');

create trigger content_comments_immutable_authorship
  before update on public.content_comments
  for each row execute function app.enforce_immutable_columns('created_at');

create trigger content_comments_authorship_not_reassigned
  before update on public.content_comments
  for each row execute function app.enforce_authorship_not_reassigned('author_id');

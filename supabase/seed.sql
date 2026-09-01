-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — DADOS FICTÍCIOS. LOCAL E STAGING. NUNCA PRODUÇÃO.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  Nada aqui é real. Nenhum e-mail, telefone, documento, CNPJ, contrato ou
--     número de negócio corresponde a pessoa ou empresa existente. Hartmann e
--     Velmont são marcas inventadas. Todos os e-mails ficam sob `example.com`,
--     domínio reservado pela IANA justamente para documentação: não resolve,
--     não recebe, não alcança ninguém.
--
--     Dado real de cliente NUNCA entra neste arquivo (.claude/rules/database.md).
--
-- POR QUE DOIS CLIENTES
--
--     Este seed não é enfeite: é a pré-condição da suíte de isolamento
--     (.claude/rules/testing.md). Com um cliente só, "o Cliente A não vê o
--     Cliente B" é uma frase sem teste possível. Então existem dois tenants
--     completos e simétricos, e pessoas de cada lado:
--
--       Hartmann ← membro A, cliente A, cliente A desabilitado
--       Velmont  ← membro B, cliente B
--       ninguém  ← membro sem vínculo   (o caso negativo puro)
--       tudo     ← boop_admin           (global, por D-08)
--
--     Cada linha de um lado tem correspondente do outro. É isso que permite
--     escrever todo caso aos pares: o que a pessoa vê E o que ela não pode ver.
--
-- IDEMPOTÊNCIA
--
--     UUIDs fixos e `on conflict do update`. Rodar duas vezes converge para o
--     mesmo estado; não duplica nem falha. `activity_log` é append-only e por
--     isso é a única parte protegida por um `not exists`.
--
-- SENHAS
--
--     Nenhuma. Os usuários nascem sem `encrypted_password`: são fixtures de
--     dados, não credenciais. Login é assunto da FASE 3, por magic link.
--
-- Convenção dos UUIDs — sinteticamente óbvios, para ninguém confundir com
-- dado de produção:
--
--     1……… profiles      4……… onboarding      6……… conteúdo
--     2……… clients       5……… estratégia      7……… notificações
--     3……… projetos

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- Trava de segurança
-- ───────────────────────────────────────────────────────────────────────────
-- Se este banco tem um cliente que não é demo, ele não é um banco de seed.
-- Melhor abortar ruidosamente do que escrever fixture por cima de dado de
-- alguém. Este erro é um pedido de atenção, não um bug.
do $$
declare
  v_foreign int;
begin
  select count(*) into v_foreign
    from public.clients
   where id not in (
     '20000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000002'
   );

  if v_foreign > 0 then
    raise exception
      'seed abortado: este banco tem % cliente(s) fora do conjunto demo. O seed e apenas para local e staging (docs/database.md#seed).',
      v_foreign
      using errcode = '42501';
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Pessoas
-- ───────────────────────────────────────────────────────────────────────────
-- `auth.users` primeiro: `public.profiles` espelha essa tabela por trigger
-- (app.handle_new_auth_user). Inserimos o perfil logo depois mesmo assim, para
-- definir papel e status — o trigger só sabe criar o espelho básico.
insert into auth.users (
  instance_id, id, aud, role, email,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@boop.example.com',        now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marina Duarte"}',  now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ana@boop.example.com',          now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Prado"}',      now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rafa@boop.example.com',         now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rafa Nunes"}',     now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'dani@boop.example.com',         now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dani Ferraz"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'cecilia@hartmann.example.com',  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Cecilia Hartmann"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'joao@velmont.example.com',      now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Joao Velmont"}',   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'marta@hartmann.example.com',    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marta Hartmann"}', now(), now())
on conflict (id) do nothing;

-- Papel é GLOBAL; escopo vem de client_memberships (ADR-0005, D-08).
insert into public.profiles (id, email, full_name, role, status, invited_at)
values
  ('10000000-0000-4000-8000-000000000001', 'admin@boop.example.com',       'Marina Duarte',     'boop_admin',  'active',   now()),
  ('10000000-0000-4000-8000-000000000002', 'ana@boop.example.com',         'Ana Prado',         'boop_member', 'active',   now()),
  ('10000000-0000-4000-8000-000000000003', 'rafa@boop.example.com',        'Rafa Nunes',        'boop_member', 'active',   now()),
  -- Sem vínculo nenhum, de propósito: é o caso negativo puro da matriz de
  -- permissões. Um boop_member sem vínculo não alcança cliente algum.
  ('10000000-0000-4000-8000-000000000004', 'dani@boop.example.com',        'Dani Ferraz',       'boop_member', 'active',   now()),
  ('10000000-0000-4000-8000-000000000005', 'cecilia@hartmann.example.com', 'Cecilia Hartmann',  'client_user', 'active',   now()),
  ('10000000-0000-4000-8000-000000000006', 'joao@velmont.example.com',     'Joao Velmont',      'client_user', 'active',   now()),
  -- Vinculada à Hartmann, porém desabilitada: prova que o vínculo sozinho não
  -- concede acesso quando o status derruba.
  ('10000000-0000-4000-8000-000000000007', 'marta@hartmann.example.com',   'Marta Hartmann',    'client_user', 'disabled', now())
on conflict (id) do update
  set email     = excluded.email,
      full_name = excluded.full_name,
      role      = excluded.role,
      status    = excluded.status;

-- ───────────────────────────────────────────────────────────────────────────
-- Tenants
-- ───────────────────────────────────────────────────────────────────────────
insert into public.clients (id, name, slug, status, notes, created_by)
values
  ('20000000-0000-4000-8000-000000000001', 'Hartmann', 'hartmann', 'active',
   'Nota interna ficticia. Serve para provar que clients.notes nunca alcanca o portal.',
   '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Velmont',  'velmont',  'active',
   'Nota interna ficticia do segundo tenant.',
   '10000000-0000-4000-8000-000000000001')
on conflict (id) do update
  set name   = excluded.name,
      slug   = excluded.slug,
      status = excluded.status,
      notes  = excluded.notes;

-- Vínculos: cada lado enxerga só o seu lado.
insert into public.client_memberships (id, client_id, user_id, created_by)
values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001')
on conflict (client_id, user_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Projetos e jornada
-- ───────────────────────────────────────────────────────────────────────────
-- Os dois projetos estão em PONTOS DIFERENTES da jornada de propósito: se
-- algum dia um vazar para o outro portal, a diferença salta aos olhos.
insert into public.projects (id, client_id, name, type, status, journey_key, cycle, starts_on, created_by)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Social Media', 'social', 'active', 'social.v1', 1, date '2026-07-14', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Social Media', 'social', 'active', 'social.v1', 1, date '2026-08-18', '10000000-0000-4000-8000-000000000001')
on conflict (id) do update
  set name      = excluded.name,
      type      = excluded.type,
      status    = excluded.status,
      cycle     = excluded.cycle,
      starts_on = excluded.starts_on;

insert into public.project_stages (id, project_id, stage_key, label, position, state, started_at, completed_at)
values
  -- Hartmann: em produção, com três etapas concluídas.
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'immersion',  'Imersão',    1, 'done',    timestamptz '2026-07-14 09:00-03', timestamptz '2026-07-24 18:00-03'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'research',   'Pesquisa',   2, 'done',    timestamptz '2026-07-25 09:00-03', timestamptz '2026-08-07 18:00-03'),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'strategy',   'Estratégia', 3, 'done',    timestamptz '2026-08-08 09:00-03', timestamptz '2026-08-26 18:00-03'),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'production', 'Produção',   4, 'current', timestamptz '2026-08-27 09:00-03', null),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 'publishing', 'Publicação', 5, 'pending', null, null),
  ('31000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', 'review',     'Review',     6, 'pending', null, null),
  -- Velmont: acabou de começar.
  ('31000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002', 'immersion',  'Imersão',    1, 'current', timestamptz '2026-08-18 09:00-03', null),
  ('31000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000002', 'research',   'Pesquisa',   2, 'pending', null, null),
  ('31000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000002', 'strategy',   'Estratégia', 3, 'pending', null, null),
  ('31000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000002', 'production', 'Produção',   4, 'pending', null, null),
  ('31000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-000000000002', 'publishing', 'Publicação', 5, 'pending', null, null),
  ('31000000-0000-4000-8000-00000000000c', '30000000-0000-4000-8000-000000000002', 'review',     'Review',     6, 'pending', null, null)
on conflict (id) do update
  set label        = excluded.label,
      position     = excluded.position,
      state        = excluded.state,
      started_at   = excluded.started_at,
      completed_at = excluded.completed_at;

-- ───────────────────────────────────────────────────────────────────────────
-- Onboarding — o template é da Boop, não de um cliente
-- ───────────────────────────────────────────────────────────────────────────
-- Diferença que o banco impõe sobre o protótipo: no mock as perguntas dizem
-- "Por que a Hartmann precisa existir?". Aqui não podem. O mesmo template é
-- servido a todo cliente, então o texto é da marca em abstrato, e o nome
-- concreto entra na renderização (FASE 7).
insert into public.onboarding_templates (id, key, name, project_type, version, is_active)
values
  ('40000000-0000-4000-8000-000000000001', 'social', 'Imersão — Social Media', 'social', 1, true)
on conflict (key, version) do update
  set name      = excluded.name,
      is_active = excluded.is_active;

insert into public.onboarding_sections (id, template_id, key, title, description, position)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'brand',       'A marca',      'Antes de falar sobre conteúdo, queremos entender uma coisa.', 1),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'business',    'O negócio',    'Agora a parte prática. Sem isso, a estratégia vira palpite.', 2),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'customer',    'O cliente',    'Quem já compra costuma explicar melhor a marca do que qualquer pesquisa.', 3),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'perception',  'Percepção',    'O que as pessoas acham hoje é o ponto de partida do que vamos construir.', 4),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 'references',  'Referências',  'Referência não é para copiar. É para calibrar o que vocês gostam.', 5),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001', 'materials',   'Materiais',    'Por último, o que vocês já têm pronto.', 6)
on conflict (template_id, key) do update
  set title       = excluded.title,
      description = excluded.description,
      position    = excluded.position;

insert into public.onboarding_questions (id, section_id, key, label, help_text, type, is_required, options, position)
values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'why',       'Por que a marca precisa existir?',                    'Sem discurso de marketing. Do jeito que vocês contariam para uma amiga.', 'long_text',     true,  null, 1),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'refuse',    'O que vocês se recusam a fazer?',                     'O que está fora de questão, mesmo que dê dinheiro.',                      'long_text',     false, null, 2),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000002', 'revenue',   'De onde vem a maior parte da receita hoje?',          null, 'single_select', true,
   '["Loja física","Instagram","Site próprio","Encomendas diretas","Revenda"]'::jsonb, 1),
  ('42000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000002', 'goal',      'O que precisa acontecer nos próximos seis meses?',    'O resultado concreto, não a intenção.', 'long_text', true,  null, 2),
  ('42000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000003', 'who',       'Descreva a última pessoa que comprou de vocês.',      'Quem era, o que levou, por quê.',       'long_text', true,  null, 1),
  ('42000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000003', 'objection', 'Qual é a objeção que mais aparece?',                  'A frase que vocês mais ouvem antes do "vou pensar".', 'short_text', false, null, 2),
  ('42000000-0000-4000-8000-000000000007', '41000000-0000-4000-8000-000000000004', 'said',      'Qual elogio vocês mais escutam?',                     null, 'short_text', false, null, 1),
  ('42000000-0000-4000-8000-000000000008', '41000000-0000-4000-8000-000000000004', 'wrong',     'O que as pessoas entendem errado sobre a marca?',     null, 'long_text',  false, null, 2),
  ('42000000-0000-4000-8000-000000000009', '41000000-0000-4000-8000-000000000005', 'admire',    'Três marcas que vocês admiram — de qualquer categoria.', null, 'long_text', false, null, 1),
  ('42000000-0000-4000-8000-00000000000a', '41000000-0000-4000-8000-000000000005', 'avoid',     'Uma marca que vocês não querem parecer.',             null, 'short_text', false, null, 2),
  ('42000000-0000-4000-8000-00000000000b', '41000000-0000-4000-8000-000000000006', 'drive',     'Link para fotos, catálogo ou manual de marca',        null, 'url',        false, null, 1),
  ('42000000-0000-4000-8000-00000000000c', '41000000-0000-4000-8000-000000000006', 'anything',  'Alguma coisa que a gente não perguntou e deveria ter perguntado?', null, 'long_text', false, null, 2)
on conflict (section_id, key) do update
  set label       = excluded.label,
      help_text   = excluded.help_text,
      type        = excluded.type,
      is_required = excluded.is_required,
      options     = excluded.options,
      position    = excluded.position;

-- Submissões: client_id NÃO aparece no insert. Vem do trigger, derivado de
-- project_id (app.derive_client_id). É a regra central de multi-tenancy.
insert into public.onboarding_submissions (id, project_id, template_id, status, started_at, submitted_at, submitted_by)
values
  ('43000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'submitted',
   timestamptz '2026-07-15 10:12-03', timestamptz '2026-07-22 16:40-03', '10000000-0000-4000-8000-000000000005'),
  -- Velmont ainda está preenchendo: é o estado que o autosave produz.
  ('43000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'draft',
   timestamptz '2026-08-19 09:30-03', null, null)
on conflict (id) do update
  set status       = excluded.status,
      started_at   = excluded.started_at,
      submitted_at = excluded.submitted_at,
      submitted_by = excluded.submitted_by;

-- O upsert por (submission_id, question_id) é exatamente o que o autosave da
-- FASE 7 faz a cada debounce. Aqui ele já é exercitado.
insert into public.onboarding_answers (id, submission_id, question_id, value)
values
  ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '"Porque joia virou item descartável e a gente queria fazer peça para durar a vida inteira."'::jsonb),
  ('44000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '"Produzir em escala fora do ateliê e vender por marketplace."'::jsonb),
  ('44000000-0000-4000-8000-000000000003', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', '"Encomendas diretas"'::jsonb),
  ('44000000-0000-4000-8000-000000000004', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000004', '"Sair da dependência de indicação e vender pelo site sem conversar antes."'::jsonb),
  ('44000000-0000-4000-8000-000000000005', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000005', '"Uma cliente de 38 anos comprando aliança de compromisso para ela mesma."'::jsonb),
  ('44000000-0000-4000-8000-000000000006', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000006', '"É caro para uma marca que eu não conheço."'::jsonb),
  ('44000000-0000-4000-8000-000000000007', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-00000000000b', '"https://exemplo.example.com/materiais"'::jsonb),
  -- Velmont respondeu duas e parou. Reabrir e continuar não pode perder nada.
  ('44000000-0000-4000-8000-000000000008', '43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', '"Porque manutenção predial é vendida no susto e a gente queria vender no combinado."'::jsonb),
  ('44000000-0000-4000-8000-000000000009', '43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000003', '"Encomendas diretas"'::jsonb)
on conflict (submission_id, question_id) do update
  set value = excluded.value;

-- ───────────────────────────────────────────────────────────────────────────
-- Estratégia — a aprovação pertence à VERSÃO (ADR-0007)
-- ───────────────────────────────────────────────────────────────────────────
insert into public.strategies (id, project_id, title)
values
  ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Direção editorial · 3º trimestre'),
  ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Direção editorial · 3º trimestre')
on conflict (id) do update
  set title = excluded.title;

insert into public.strategy_versions (id, strategy_id, version, status, summary, content, created_by, sent_at, approved_at)
values
  -- Hartmann v1: aprovada. É a versão corrente.
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'approved',
   'Joia que dura a vida inteira, contada por quem faz.',
   '{"positioning":"A joalheria que assume o tempo como material.","territories":[{"label":"Universo Hartmann","description":"A história por trás de quem faz."},{"label":"Guia Hartmann","description":"O que ninguém explica antes de comprar joia."}],"metrics":["alcance","salvamentos","conversas iniciadas"]}'::jsonb,
   '10000000-0000-4000-8000-000000000002', timestamptz '2026-08-20 11:00-03', timestamptz '2026-08-26 15:20-03'),
  -- Hartmann v2: rascunho interno. O cliente NÃO pode vê-la — é o caso
  -- negativo de versionamento (docs/security.md).
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 2, 'draft',
   'Revisão do 4º trimestre, ainda em escrita.',
   '{"positioning":"Rascunho interno. Nao publicado."}'::jsonb,
   '10000000-0000-4000-8000-000000000002', null, null),
  -- Velmont v1: aguardando o cliente. Serve para o par "Hartmann não vê isto".
  ('51000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 1, 'awaiting_client',
   'Manutenção previsível, sem susto.',
   '{"positioning":"A manutencao predial que avisa antes.","territories":[{"label":"Antes que quebre","description":"Prevencao explicada sem jargao."}],"metrics":["alcance","contatos qualificados"]}'::jsonb,
   '10000000-0000-4000-8000-000000000003', timestamptz '2026-08-28 10:00-03', null)
on conflict (id) do update
  set status      = excluded.status,
      summary     = excluded.summary,
      content     = excluded.content,
      sent_at     = excluded.sent_at,
      approved_at = excluded.approved_at;

update public.strategies
   set current_version_id = '51000000-0000-4000-8000-000000000001'
 where id = '50000000-0000-4000-8000-000000000001';

update public.strategies
   set current_version_id = '51000000-0000-4000-8000-000000000003'
 where id = '50000000-0000-4000-8000-000000000002';

-- Quem aprovou é `client_user`. Nem boop_admin aprova (docs/permissions.md).
insert into public.strategy_approvals (id, strategy_version_id, decided_by, decision, note)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000005', 'approved', 'Perfeito. Pode seguir.')
on conflict (id) do update
  set decision = excluded.decision,
      note     = excluded.note;

-- ───────────────────────────────────────────────────────────────────────────
-- Conteúdo
-- ───────────────────────────────────────────────────────────────────────────
-- A grade cobre o pipeline inteiro de propósito, incluindo os quatro status
-- que o cliente NUNCA pode ver: idea, planned, in_production, internal_review.
-- Sem eles no seed, a suíte de isolamento não teria o que provar.
insert into public.content_items
  (id, project_id, title, channel, format, editorial_territory, objective, status, scheduled_for, published_at, published_url, created_by)
values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Bastidores do ateliê',            'instagram', 'reel',     'Universo Hartmann', 'Mostrar o processo',        'idea',            null, null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Como escolher o fecho',           'instagram', 'carousel', 'Guia Hartmann',     'Educar antes da compra',    'in_production',   null, null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Por que criamos a Hartmann',      'instagram', 'video',    'Universo Hartmann', 'Apresentar a marca',        'awaiting_client', timestamptz '2026-09-04 14:00-03', null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'Quanto tempo dura uma joia',      'instagram', 'carousel', 'Guia Hartmann',     'Justificar o preço',        'awaiting_client', timestamptz '2026-09-09 10:00-03', null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 'A cliente que comprou para si',   'instagram', 'static',   'Universo Hartmann', 'Prova social',              'approved',        timestamptz '2026-09-11 18:00-03', null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', 'O ouro que a gente usa',          'instagram', 'reel',     'Guia Hartmann',     'Transparência',             'published',       timestamptz '2026-08-28 12:00-03', timestamptz '2026-08-28 12:04-03', 'https://exemplo.example.com/p/ouro', '10000000-0000-4000-8000-000000000002'),
  -- Velmont
  ('60000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002', 'O que ninguém checa no prédio',   'linkedin',  'carousel', 'Antes que quebre',  'Gerar contato',             'awaiting_client', timestamptz '2026-09-05 09:00-03', null, null, '10000000-0000-4000-8000-000000000003'),
  ('60000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000002', 'Três sinais de infiltração',        'linkedin',  'static',   'Antes que quebre',  'Educar',                    'idea',            null, null, null, '10000000-0000-4000-8000-000000000003')
on conflict (id) do update
  set title               = excluded.title,
      channel             = excluded.channel,
      format              = excluded.format,
      editorial_territory = excluded.editorial_territory,
      objective           = excluded.objective,
      status              = excluded.status,
      scheduled_for       = excluded.scheduled_for,
      published_at        = excluded.published_at,
      published_url       = excluded.published_url;

-- `sent_for_approval_at is null` é o critério de visibilidade da versão. As
-- versões abaixo com null nunca foram vistas pelo cliente, por definição.
insert into public.content_versions
  (id, content_item_id, version, status, hook, caption, cta, internal_notes, created_by, sent_for_approval_at, approved_at)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 1, 'draft',
   'O detalhe que decide se a joia dura', 'Rascunho de legenda em produção.', 'Salve para depois',
   'Falta revisar o terceiro slide antes de enviar.', '10000000-0000-4000-8000-000000000002', null, null),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000003', 1, 'awaiting_client',
   'Nenhuma peça parecia feita para durar uma vida inteira',
   'A Hartmann nasceu de uma frustração simples. Neste vídeo, Cecília e Marta contam o que estava faltando — e por que decidiram fazer elas mesmas.',
   'Conheça a marca', 'Legendar o vídeo antes de publicar.', '10000000-0000-4000-8000-000000000002',
   timestamptz '2026-08-29 09:10-03', null),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000004', 1, 'changes_requested',
   'Uma joia bem feita dura mais que você',
   'Primeira versão da legenda, com o tom que a cliente pediu para ajustar.', 'Veja o guia',
   null, '10000000-0000-4000-8000-000000000002', timestamptz '2026-08-27 15:00-03', null),
  ('61000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000004', 2, 'awaiting_client',
   'Quanto tempo dura uma joia de verdade?',
   'Reescrita com o tom mais direto que vocês pediram. O terceiro slide agora abre com o número, não com a explicação.',
   'Veja o guia', null, '10000000-0000-4000-8000-000000000002', timestamptz '2026-08-30 11:30-03', null),
  ('61000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000005', 1, 'approved',
   'Ela comprou a aliança para ela mesma',
   'Não era noivado. Era uma promessa que ela fez para si.', 'Leia a história',
   null, '10000000-0000-4000-8000-000000000002', timestamptz '2026-08-25 14:00-03', timestamptz '2026-08-26 09:12-03'),
  ('61000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006', 1, 'approved',
   'De onde vem o ouro que a gente usa',
   'Rastreável, reciclado e com nota. Explicamos como funciona.', 'Saiba mais',
   null, '10000000-0000-4000-8000-000000000002', timestamptz '2026-08-21 10:00-03', timestamptz '2026-08-22 08:40-03'),
  ('61000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000007', 1, 'awaiting_client',
   'O que ninguém checa no prédio até dar problema',
   'Cinco itens que passam despercebidos na vistoria mensal — e o que cada um custa quando falha.',
   'Fale com a gente', null, '10000000-0000-4000-8000-000000000003', timestamptz '2026-08-31 09:00-03', null)
on conflict (id) do update
  set status               = excluded.status,
      hook                 = excluded.hook,
      caption              = excluded.caption,
      cta                  = excluded.cta,
      internal_notes       = excluded.internal_notes,
      sent_for_approval_at = excluded.sent_for_approval_at,
      approved_at          = excluded.approved_at;

update public.content_items i
   set current_version_id = v.id
  from public.content_versions v
 where v.content_item_id = i.id
   and v.version = (select max(v2.version) from public.content_versions v2 where v2.content_item_id = i.id)
   and i.current_version_id is distinct from v.id;

-- Comentários: um interno no meio dos públicos. É o par obrigatório do teste
-- "o cliente lê o público E não lê o interno".
insert into public.content_comments (id, content_item_id, content_version_id, author_id, body, is_internal)
values
  ('62000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000005', 'Amei. Só o começo ficou um pouco lento.', false),
  ('62000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002', 'Anotado — cortamos os dois primeiros segundos na edição.', false),
  ('62000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002', 'Nota interna: pedir o raw do B-roll para a Dani antes de fechar.', true),
  ('62000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000005', 'Pode ficar mais direto? Achei explicativo demais.', false),
  ('62000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000007', '61000000-0000-4000-8000-000000000007',
   '10000000-0000-4000-8000-000000000006', 'Bom. Só trocar "vistoria" por "checagem".', false)
on conflict (id) do update
  set body        = excluded.body,
      is_internal = excluded.is_internal;

insert into public.content_approvals (id, content_version_id, decided_by, decision, note)
values
  ('63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000005', 'changes_requested', 'Pode ficar mais direto? Achei explicativo demais.'),
  ('63000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000005', 'approved', null),
  ('63000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000006',
   '10000000-0000-4000-8000-000000000005', 'approved', null)
on conflict (id) do update
  set decision = excluded.decision,
      note     = excluded.note;

-- ───────────────────────────────────────────────────────────────────────────
-- Sistema
-- ───────────────────────────────────────────────────────────────────────────
-- `activity_log` é append-only: não dá para reescrever nem apagar, nem aqui.
-- Por isso este bloco tem guarda própria — o resto do seed converge por
-- upsert, este só roda quando o log dos tenants demo ainda está vazio.
--
-- Repare no `metadata`: só identificadores e transições. Nenhuma legenda,
-- nenhum e-mail, nenhum texto de cliente (.claude/rules/security.md).
insert into public.activity_log
  (actor_id, client_id, project_id, entity_type, entity_id, action, metadata, visibility, created_at)
select
  v.actor_id::uuid, v.client_id::uuid, v.project_id::uuid, v.entity_type,
  v.entity_id::uuid, v.action, v.metadata::jsonb,
  v.visibility::public.activity_visibility, v.created_at::timestamptz
from (values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'project',          '30000000-0000-4000-8000-000000000001', 'project.created',           '{}',                                                  'internal', '2026-07-14 09:00-03'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'onboarding',       '43000000-0000-4000-8000-000000000001', 'onboarding.submitted',      '{"answered":7}',                                      'client',   '2026-07-22 16:40-03'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'strategy_version', '51000000-0000-4000-8000-000000000001', 'strategy.sent',             '{"version":1,"to":"awaiting_client"}',                'client',   '2026-08-20 11:00-03'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'strategy_version', '51000000-0000-4000-8000-000000000001', 'strategy.approved',         '{"version":1,"from":"awaiting_client","to":"approved"}', 'client', '2026-08-26 15:20-03'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'content_version',  '61000000-0000-4000-8000-000000000004', 'content.sent_for_approval', '{"item":"60000000-0000-4000-8000-000000000004","version":2}', 'client', '2026-08-30 11:30-03'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'content_version',  '61000000-0000-4000-8000-000000000003', 'content.changes_requested', '{"item":"60000000-0000-4000-8000-000000000004","version":1}', 'client', '2026-08-29 18:05-03'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'project',          '30000000-0000-4000-8000-000000000002', 'project.created',           '{}',                                                  'internal', '2026-08-18 09:00-03'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'content_version',  '61000000-0000-4000-8000-000000000007', 'content.sent_for_approval', '{"item":"60000000-0000-4000-8000-000000000007","version":1}', 'client', '2026-08-31 09:00-03')
) as v(actor_id, client_id, project_id, entity_type, entity_id, action, metadata, visibility, created_at)
where not exists (
  select 1
    from public.activity_log
   where client_id in (
     '20000000-0000-4000-8000-000000000001',
     '20000000-0000-4000-8000-000000000002'
   )
);

-- Notificações: a linha nasce ANTES da tentativa de envio. A falha fica no
-- banco, visível, com erro — nunca silenciosa (.claude/rules/integrations.md).
insert into public.notifications
  (id, client_id, project_id, recipient_user_id, recipient_email, template, payload, status, dedupe_key, provider_message_id, error, created_at, sent_at)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000005', 'cecilia@hartmann.example.com', 'content.awaiting_client',
   '{"contentVersionId":"61000000-0000-4000-8000-000000000004","count":2}'::jsonb, 'sent',
   'content.awaiting_client:61000000-0000-4000-8000-000000000004', 'demo-message-0001', null,
   timestamptz '2026-08-30 11:30-03', timestamptz '2026-08-30 11:30-03'),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000006', 'joao@velmont.example.com', 'content.awaiting_client',
   '{"contentVersionId":"61000000-0000-4000-8000-000000000007","count":1}'::jsonb, 'pending',
   'content.awaiting_client:61000000-0000-4000-8000-000000000007', null, null,
   timestamptz '2026-08-31 09:00-03', null),
  -- Uma falha de propósito: é o que a fila de reenvio da FASE 16 vai ler.
  ('70000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000007', 'marta@hartmann.example.com', 'strategy.approved',
   '{"strategyVersionId":"51000000-0000-4000-8000-000000000001"}'::jsonb, 'failed',
   'strategy.approved:51000000-0000-4000-8000-000000000001', null, 'provider_unavailable',
   timestamptz '2026-08-26 15:20-03', null)
on conflict (dedupe_key) do nothing;

commit;

-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v_clients int;
  v_people  int;
begin
  select count(*) into v_clients from public.clients;
  select count(*) into v_people  from public.profiles;
  raise notice 'seed aplicado: % tenants, % pessoas, dados ficticios (docs/database.md#seed)', v_clients, v_people;
end;
$$;

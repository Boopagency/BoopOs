-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 7 — O CATÁLOGO SOCIAL SAI DO SEED E VIRA SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Por que uma migration, e não o seed
--
-- O formulário de onboarding é **produto da Boop**, não dado de um cliente:
-- `onboarding_templates` não tem `client_id`, e a mesma linha é servida a
-- todos os tenants. O seed, porém, não roda em staging nem em produção
-- (docs/database.md#seed) — então até aqui o catálogo existia SÓ na máquina de
-- quem desenvolve, e o onboarding seria impossível de abrir no ambiente
-- hospedado.
--
-- Migration idempotente resolve isso do jeito que a regra de mudança de schema
-- pede: forward-only, reproduzível, e o mesmo resultado em qualquer ambiente.
--
-- ## Os ids são os do seed, de propósito
--
-- `40…`, `41…` e `42…` são exatamente os identificadores estáveis que o
-- `seed.sql` usava, e por isso `tests/rls/support/fixtures.ts` e a submissão
-- semeada continuam apontando para as mesmas linhas. Gerar uuid novo aqui
-- tornaria migration e seed incompatíveis — banco recriado do zero teria dois
-- catálogos, um deles órfão.
--
-- O `on conflict … do update` faz a migration convergir em vez de falhar num
-- banco que já tem o catálogo (o caso de todo ambiente de desenvolvimento que
-- rodou o seed antes desta fase).
--
-- ## O que este catálogo NÃO tem
--
-- Nenhuma pergunta do tipo `file`: o renderizador e a validação desse tipo são
-- da FASE 12 (spec-review I-05). Nenhum nome de cliente: o mesmo template é
-- servido a todo mundo, então o texto fala da marca em abstrato.
--
-- A copy é a que já estava especificada no seed. Nada foi reescrito.

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

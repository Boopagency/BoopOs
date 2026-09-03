-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 7 — INTEGRIDADE DA RESPOSTA: A PERGUNTA É DAQUELE TEMPLATE, E O VALOR
--          TEM A FORMA DAQUELE TIPO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O buraco que esta migration fecha
--
-- A autorização de `onboarding_answers` é derivada da SUBMISSÃO
-- (`app.can_answer_submission`): "esta submissão é sua, e ainda está em
-- rascunho?". É a pergunta certa sobre tenant, e não diz nada sobre a
-- PERGUNTA.
--
-- Consequência, até aqui: com a própria submissão em mãos, qualquer pessoa
-- podia gravar uma resposta apontando para um `question_id` de OUTRO template.
-- A linha ficava autorizada (a submissão é dela) e semanticamente corrompida —
-- uma resposta cuja pergunta não existe no formulário que ela respondeu.
-- A leitura no admin passaria a mostrar pergunta que aquele cliente nunca viu,
-- e o `submit` contaria obrigatórias do template certo enquanto o cliente
-- respondia outro.
--
-- E o `value` é `jsonb`, o que nunca quis dizer "qualquer json serve": o tipo
-- da pergunta é que decide a forma, e `single_select` também decide o
-- CONJUNTO de valores aceitáveis.
--
-- ## Por que trigger, e não policy
--
-- Uma `with check` na policy valeria só para `authenticated`. Isto aqui não é
-- autorização — é invariante de dado, da mesma família de `derive_client_id`:
-- vale para todo papel, inclusive `service_role`, inclusive uma migration
-- futura distraída. Trigger é o único lugar onde ela não tem porta dos fundos.
--
-- A dupla `submission_id`/`question_id` já é imutável desde a FASE 2
-- (`onboarding_answers_immutable`), então o vetor real é o INSERT. O trigger
-- cobre `update` mesmo assim: uma linha que só pode ser reescrita no `value`
-- ainda pode receber um `value` de forma errada.
--
-- ## O que NÃO foi feito
--
-- Não existe `template_id` em `onboarding_answers`. Copiar a coluna para poder
-- comparar em SQL barato seria criar uma segunda verdade sobre a mesma
-- relação — a que já se deriva por `question → section → template`.

-- ───────────────────────────────────────────────────────────────────────────
-- A forma de um valor, por tipo de pergunta
-- ───────────────────────────────────────────────────────────────────────────
--
-- `""` é forma VÁLIDA: o cliente apagou o campo, e o rascunho aceita campo
-- vazio. "Está preenchido?" é outra pergunta, e tem outra função (abaixo).
--
-- `file` cai no `else`: o tipo existe no enum desde a primeira migration, mas
-- o renderizador e a validação dele são da FASE 12 (spec-review I-05). Até lá
-- ele é recusado — fail closed —, e não aceito como texto qualquer.
create or replace function app.answer_value_is_valid(
  p_type    public.question_type,
  p_options jsonb,
  p_value   jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) = 'null' then false

    when p_type in ('short_text', 'long_text', 'url') then jsonb_typeof(p_value) = 'string'
    when p_type = 'boolean' then jsonb_typeof(p_value) = 'boolean'
    when p_type = 'number'  then jsonb_typeof(p_value) = 'number'

    -- Escolha fora das alternativas do template é resposta inventada.
    when p_type = 'single_select' then
      jsonb_typeof(p_value) = 'string'
      and coalesce(p_options, '[]'::jsonb) @> jsonb_build_array(p_value)

    when p_type = 'multi_select' then
      jsonb_typeof(p_value) = 'array'
      and not exists (
        select 1
          from jsonb_array_elements(p_value) as elemento
         where jsonb_typeof(elemento.value) <> 'string'
            or not (coalesce(p_options, '[]'::jsonb) @> jsonb_build_array(elemento.value))
      )

    else false
  end
$$;

comment on function app.answer_value_is_valid(public.question_type, jsonb, jsonb) is
  'A FORMA do valor conforme o tipo da pergunta. Texto vazio e valido (rascunho); '
  'opcao fora do template nao e. `file` recusado ate a FASE 12.';

-- ───────────────────────────────────────────────────────────────────────────
-- "Está preenchido?" — a pergunta do submit, e só dele
-- ───────────────────────────────────────────────────────────────────────────
--
-- Deliberadamente NÃO é truthiness. `false` é resposta legítima de um
-- `boolean`, `0` é resposta legítima de um `number`, e os dois são falsy em
-- praticamente toda linguagem — inclusive na que renderiza o formulário. A
-- semântica de "vazio" é por tipo, e mora aqui, uma vez.
create or replace function app.answer_is_present(
  p_type  public.question_type,
  p_value jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) = 'null' then false

    -- Só espaço em branco é vazio: "   " não responde nada.
    when p_type in ('short_text', 'long_text', 'url', 'single_select') then
      jsonb_typeof(p_value) = 'string' and btrim(p_value #>> '{}') <> ''

    when p_type = 'boolean' then jsonb_typeof(p_value) = 'boolean'
    when p_type = 'number'  then jsonb_typeof(p_value) = 'number'

    when p_type = 'multi_select' then
      jsonb_typeof(p_value) = 'array' and jsonb_array_length(p_value) > 0

    else false
  end
$$;

comment on function app.answer_is_present(public.question_type, jsonb) is
  'Preenchimento semantico por tipo, para a validacao de obrigatorias no submit. '
  'false e 0 SAO respostas; "   " e [] nao sao.';

-- ───────────────────────────────────────────────────────────────────────────
-- O trigger
-- ───────────────────────────────────────────────────────────────────────────
--
-- `security definer` para que a decisão seja a mesma para todo papel. Sem ele,
-- a busca da pergunta seria filtrada pela RLS de quem escreve, e uma pergunta
-- de outro template viraria "pergunta inexistente" para um cliente e
-- "pergunta de outro template" para a Boop — mesma recusa, duas explicações, e
-- a segunda dependendo de quem pergunta.
--
-- `23514` (check_violation) é o mesmo código dos triggers de imutabilidade da
-- FASE 5: para quem chama, é a mesma classe de recusa — o banco disse não a
-- uma linha malformada.
create or replace function app.enforce_answer_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_da_submissao uuid;
  v_template_da_pergunta  uuid;
  v_tipo    public.question_type;
  v_options jsonb;
begin
  select s.template_id
    into v_template_da_submissao
    from public.onboarding_submissions s
   where s.id = new.submission_id;

  if v_template_da_submissao is null then
    raise exception 'onboarding_answers: submissao inexistente'
      using errcode = '23514';
  end if;

  select sec.template_id, q.type, q.options
    into v_template_da_pergunta, v_tipo, v_options
    from public.onboarding_questions q
    join public.onboarding_sections sec on sec.id = q.section_id
   where q.id = new.question_id;

  if v_template_da_pergunta is null then
    raise exception 'onboarding_answers: pergunta inexistente'
      using errcode = '23514';
  end if;

  if v_template_da_pergunta <> v_template_da_submissao then
    raise exception
      'onboarding_answers: a pergunta % pertence ao template %, e a submissao responde o template %',
      new.question_id, v_template_da_pergunta, v_template_da_submissao
      using errcode = '23514';
  end if;

  if not app.answer_value_is_valid(v_tipo, v_options, new.value) then
    raise exception 'onboarding_answers: valor invalido para uma pergunta do tipo %', v_tipo
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function app.enforce_answer_integrity() is
  'A pergunta tem que ser do template que a submissao responde, e o valor tem que '
  'ter a forma do tipo dela. Trigger, e nao policy: e invariante de dado, e vale '
  'inclusive para service_role.';

create trigger onboarding_answers_enforce_integrity
  before insert or update on public.onboarding_answers
  for each row execute function app.enforce_answer_integrity();

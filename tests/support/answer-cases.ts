import type { QuestionType } from '@/config/enums'

/**
 * A tabela de casos da semântica de resposta — UMA, lida por duas suítes.
 *
 * A semântica existe em dois lugares por necessidade: no banco
 * (`app.answer_value_is_valid` / `app.answer_is_present`), que é a autoridade e
 * vale para todo papel, e em TypeScript (`src/domains/onboarding/answers.ts`),
 * que é o que permite o formulário marcar a obrigatória faltante sem uma
 * viagem ao servidor.
 *
 * Duas implementações da mesma regra divergem — é o que sempre acontece. O que
 * impede a divergência de virar bug é este arquivo: `tests/unit` roda os casos
 * contra o TypeScript, `tests/rls` roda os MESMOS casos contra o Postgres e
 * ainda confere que as duas respostas batem, uma a uma.
 *
 * Mora em `tests/support` e não dentro de uma das suítes porque pertence às
 * duas igualmente. Não casa com o glob de nenhum `include`, então o vitest não
 * o trata como arquivo de teste.
 */
export interface AnswerCase {
  /** O que este caso prova. Vira o nome do teste. */
  nome: string
  type: QuestionType
  options: string[]
  /** Já em JSON: é o que vai para `jsonb` e para o estado do formulário. */
  value: unknown
  /** A forma bate com o tipo, e a opção existe no template? */
  valida: boolean
  /** Está semanticamente preenchida? (a pergunta do submit) */
  presente: boolean
}

const RECEITA = ['Loja física', 'Instagram', 'Site próprio']

export const ANSWER_CASES: AnswerCase[] = [
  /* ── Texto ──────────────────────────────────────────────────────────────── */
  {
    nome: 'texto curto preenchido',
    type: 'short_text',
    options: [],
    value: 'Caro para uma marca que eu não conheço.',
    valida: true,
    presente: true,
  },
  {
    nome: 'texto longo preenchido',
    type: 'long_text',
    options: [],
    value: 'Porque joia virou item descartável.',
    valida: true,
    presente: true,
  },
  {
    /* O caso do rascunho: apagar o campo é uma gravação legítima. */
    nome: 'texto vazio é FORMA válida, mas não está preenchido',
    type: 'long_text',
    options: [],
    value: '',
    valida: true,
    presente: false,
  },
  {
    nome: 'só espaço em branco não responde nada',
    type: 'short_text',
    options: [],
    value: '   ',
    valida: true,
    presente: false,
  },
  {
    nome: 'número onde se espera texto é forma inválida',
    type: 'long_text',
    options: [],
    value: 42,
    valida: false,
    presente: false,
  },
  {
    nome: 'url é texto',
    type: 'url',
    options: [],
    value: 'https://exemplo.example.com/materiais',
    valida: true,
    presente: true,
  },

  /* ── Booleano: `false` É resposta ───────────────────────────────────────── */
  {
    nome: 'boolean true',
    type: 'boolean',
    options: [],
    value: true,
    valida: true,
    presente: true,
  },
  {
    /* O caso que qualquer checagem de truthiness recusaria por engano. */
    nome: '⚠️ boolean FALSE é uma resposta preenchida',
    type: 'boolean',
    options: [],
    value: false,
    valida: true,
    presente: true,
  },
  {
    nome: 'texto onde se espera boolean é forma inválida',
    type: 'boolean',
    options: [],
    value: 'true',
    valida: false,
    presente: false,
  },

  /* ── Número: `0` É resposta ─────────────────────────────────────────────── */
  {
    nome: 'number positivo',
    type: 'number',
    options: [],
    value: 12,
    valida: true,
    presente: true,
  },
  {
    /* O outro falsy que é resposta legítima. */
    nome: '⚠️ number ZERO é uma resposta preenchida',
    type: 'number',
    options: [],
    value: 0,
    valida: true,
    presente: true,
  },
  {
    nome: 'number negativo',
    type: 'number',
    options: [],
    value: -3,
    valida: true,
    presente: true,
  },
  {
    nome: 'texto numérico não é number',
    type: 'number',
    options: [],
    value: '12',
    valida: false,
    presente: false,
  },

  /* ── Escolha única ──────────────────────────────────────────────────────── */
  {
    nome: 'opção que existe no template',
    type: 'single_select',
    options: RECEITA,
    value: 'Instagram',
    valida: true,
    presente: true,
  },
  {
    /* O caso adversarial: escolha inventada é resposta inventada. */
    nome: '⚠️ opção FORA do template é recusada',
    type: 'single_select',
    options: RECEITA,
    value: 'Opção Inventada',
    valida: false,
    presente: true,
  },
  {
    nome: 'escolha única não aceita array',
    type: 'single_select',
    options: RECEITA,
    value: ['Instagram'],
    valida: false,
    presente: false,
  },

  /* ── Escolha múltipla ───────────────────────────────────────────────────── */
  {
    nome: 'duas opções válidas',
    type: 'multi_select',
    options: RECEITA,
    value: ['Instagram', 'Loja física'],
    valida: true,
    presente: true,
  },
  {
    nome: 'lista vazia é FORMA válida, mas não está preenchida',
    type: 'multi_select',
    options: RECEITA,
    value: [],
    valida: true,
    presente: false,
  },
  {
    nome: '⚠️ uma opção inventada no meio de válidas recusa a lista inteira',
    type: 'multi_select',
    options: RECEITA,
    value: ['Instagram', 'Opção Inventada'],
    valida: false,
    presente: true,
  },
  {
    nome: 'escolha múltipla não aceita texto solto',
    type: 'multi_select',
    options: RECEITA,
    value: 'Instagram',
    valida: false,
    presente: false,
  },

  /* ── `file`: adiado para a FASE 12, e fail closed até lá ─────────────────── */
  {
    nome: '⚠️ file é recusado — o tipo existe no enum, a implementação é da FASE 12',
    type: 'file',
    options: [],
    value: 'https://exemplo.example.com/arquivo.pdf',
    valida: false,
    presente: false,
  },
  {
    nome: 'file com objeto também é recusado',
    type: 'file',
    options: [],
    value: { file_id: '00000000-0000-4000-8000-000000000000' },
    valida: false,
    presente: false,
  },

  /* ── Nulo ───────────────────────────────────────────────────────────────── */
  {
    nome: 'null nunca é forma válida nem resposta',
    type: 'long_text',
    options: [],
    value: null,
    valida: false,
    presente: false,
  },
]

/**
 * ⚠️  DADOS FICTÍCIOS — PROTÓTIPO VISUAL DA FASE 1.5
 *
 * Hartmann é uma marca inventada, criada só para dar corpo ao protótipo.
 * Nada aqui é cliente real, nenhum número é medição real.
 *
 * Este arquivo é a ÚNICA fonte de dados falsos do repositório. Nenhum
 * componente o importa: todo acesso passa por `src/lib/data/portal.ts`, que
 * na FASE 5 troca esta fonte por repositories sobre o Supabase sem que
 * nenhuma tela mude (docs/architecture.md).
 */
import type {
  AttentionItem,
  ContentItem,
  Delivery,
  Insight,
  JourneyStage,
  Meeting,
  OnboardingSection,
  ProjectFile,
  ProjectSummary,
  ResultsPeriod,
  Strategy,
} from '@/lib/data/types'

export const PROJECT: ProjectSummary = {
  id: 'hartmann-social',
  clientName: 'Hartmann',
  name: 'Social Media',
  type: 'social',
  cycle: 1,
  startedOn: '2026-07-14',
  scope: [
    'Imersão de marca e pesquisa de categoria',
    'Direção editorial trimestral',
    '12 conteúdos por mês para Instagram',
    'Review mensal de resultados e aprendizados',
  ],
  team: [
    { name: 'Ana', role: 'Estratégia' },
    { name: 'Rafa', role: 'Conteúdo' },
    { name: 'Dani', role: 'Design' },
  ],
}

export const JOURNEY: JourneyStage[] = [
  {
    key: 'immersion',
    label: 'Imersão',
    state: 'done',
    summary: 'Entendemos o negócio, a história e o que a Hartmann quer construir.',
    completedOn: '2026-07-24',
  },
  {
    key: 'research',
    label: 'Pesquisa',
    state: 'done',
    summary: 'Estudamos a categoria, as concorrentes e como as pessoas compram joia hoje.',
    completedOn: '2026-08-07',
  },
  {
    key: 'strategy',
    label: 'Estratégia',
    state: 'done',
    summary: 'Definimos posicionamento, territórios editoriais e o que vamos medir.',
    completedOn: '2026-08-26',
  },
  {
    key: 'production',
    label: 'Produção',
    state: 'current',
    summary: 'Estamos criando o primeiro ciclo editorial. Parte já está com você.',
  },
  {
    key: 'publishing',
    label: 'Publicação',
    state: 'pending',
    summary: 'O que for aprovado entra no ar na ordem combinada.',
  },
  {
    key: 'review',
    label: 'Review',
    state: 'pending',
    summary: 'Olhamos os números juntas e decidimos o que muda no próximo ciclo.',
  },
]

export const ATTENTION: AttentionItem[] = [
  {
    id: 'content-awaiting',
    kind: 'content',
    count: 3,
    label: 'conteúdos aguardando você',
    href: '/portal/hartmann-social/conteudo',
    cta: 'Revisar agora',
  },
]

export const NEXT_DELIVERY: Delivery = {
  title: 'Primeiro ciclo editorial',
  description: 'Doze peças para setembro, com legenda, arte e data prevista.',
  dueOn: '2026-09-04',
}

export const MEETINGS: Meeting[] = [
  {
    id: 'm-review-set',
    type: 'review',
    title: 'Review mensal · Setembro',
    description: 'O que aconteceu, o que funcionou e o que muda no ciclo 2.',
    startAt: '2026-09-30T14:00:00-03:00',
    durationMinutes: 60,
    status: 'scheduled',
    url: 'https://meet.example.com/boop-hartmann',
  },
  {
    id: 'm-strategy',
    type: 'strategy',
    title: 'Apresentação da direção editorial',
    startAt: '2026-08-26T10:00:00-03:00',
    durationMinutes: 90,
    status: 'completed',
  },
  {
    id: 'm-immersion',
    type: 'immersion',
    title: 'Imersão de marca',
    startAt: '2026-07-24T09:30:00-03:00',
    durationMinutes: 180,
    status: 'completed',
  },
]

export const DASHBOARD_INSIGHT: Insight = {
  id: 'i-founders',
  headline: 'Quando vocês aparecem, as pessoas compartilham.',
  detail:
    'Nos testes do ciclo zero, as peças com as fundadoras foram compartilhadas 2,4× mais que as peças só de produto. A direção do ciclo 1 leva isso a sério.',
  evidence: 'Base: 8 publicações entre 12/08 e 28/08.',
}

export const CONTENT: ContentItem[] = [
  {
    id: 'reel-004',
    reference: 'REEL 004',
    title: 'Por que criamos a Hartmann',
    channel: 'instagram',
    format: 'reel',
    status: 'awaiting_client',
    objective: 'Construção de marca',
    territory: 'Universo Hartmann',
    scheduledFor: '2026-09-08T10:00:00-03:00',
    previewTone: 'navy',
    versionCount: 3,
    currentVersion: {
      version: 3,
      hook: 'A gente começou porque não achava nada que a gente quisesse usar.',
      caption:
        'A Hartmann nasceu de uma frustração simples: nenhuma peça parecia feita para durar uma vida inteira.\n\nNeste vídeo, Cecília e Marta contam o que estava faltando — e por que decidiram fazer elas mesmas.',
      cta: 'Conhece a história? Conta pra gente nos comentários.',
      createdOn: '2026-08-29',
    },
    comments: [
      {
        id: 'c1',
        author: 'Rafa · Boop',
        authorSide: 'boop',
        body: 'Ajustamos o gancho para começar pela frustração, como conversamos na imersão.',
        createdOn: '2026-08-29',
      },
    ],
  },
  {
    id: 'carousel-005',
    reference: 'CARROSSEL 005',
    title: 'Como escolher seu primeiro anel',
    channel: 'instagram',
    format: 'carousel',
    status: 'awaiting_client',
    objective: 'Educar e gerar salvamentos',
    territory: 'Guia Hartmann',
    scheduledFor: '2026-09-11T10:00:00-03:00',
    previewTone: 'bone',
    versionCount: 1,
    currentVersion: {
      version: 1,
      hook: 'Medida, metal, formato. Nessa ordem.',
      caption:
        'Todo mundo começa pelo formato. A gente começa pela medida — é o que decide se você vai usar a peça todo dia ou guardar na gaveta.\n\nSalva pra quando for escolher o seu.',
      cta: 'Salva para consultar depois.',
      createdOn: '2026-08-30',
    },
    comments: [],
  },
  {
    id: 'reel-006',
    reference: 'REEL 006',
    title: 'Por trás da peça',
    channel: 'instagram',
    format: 'reel',
    status: 'awaiting_client',
    objective: 'Mostrar processo e justificar preço',
    territory: 'Ofício',
    scheduledFor: '2026-09-15T10:00:00-03:00',
    previewTone: 'slate',
    versionCount: 1,
    currentVersion: {
      version: 1,
      hook: 'São onze etapas até virar anel. Essa é a sexta.',
      caption:
        'Filmamos uma tarde inteira na bancada. O que dá para mostrar em quarenta segundos é pouco, mas dá para entender por que uma peça leva o tempo que leva.',
      cta: 'Quer ver as outras etapas? Responde aqui.',
      createdOn: '2026-08-30',
    },
    comments: [],
  },
  {
    id: 'carousel-003',
    reference: 'CARROSSEL 003',
    title: 'O que significa ouro 18k',
    channel: 'instagram',
    format: 'carousel',
    status: 'approved',
    objective: 'Educar',
    territory: 'Guia Hartmann',
    scheduledFor: '2026-09-04T10:00:00-03:00',
    previewTone: 'sky',
    versionCount: 2,
    currentVersion: {
      version: 2,
      hook: '18k não é uma nota. É uma proporção.',
      caption:
        'Setenta e cinco por cento de ouro puro. O resto é liga, e é a liga que decide a cor.\n\nEntender isso muda a forma como você compara preço.',
      cta: 'Ficou alguma dúvida? Pergunta aqui.',
      createdOn: '2026-08-22',
    },
    comments: [
      {
        id: 'c2',
        author: 'Cecília · Hartmann',
        authorSide: 'client',
        body: 'Perfeito assim. Só confirmamos que a proporção está certa.',
        createdOn: '2026-08-25',
      },
    ],
  },
  {
    id: 'reel-002',
    reference: 'REEL 002',
    title: 'A primeira encomenda',
    channel: 'instagram',
    format: 'reel',
    status: 'published',
    objective: 'Construção de marca',
    territory: 'Universo Hartmann',
    scheduledFor: '2026-08-28T10:00:00-03:00',
    previewTone: 'navy',
    versionCount: 1,
    currentVersion: {
      version: 1,
      hook: 'A primeira peça que a gente vendeu foi para a nossa professora.',
      caption: 'Onze anos depois, ela ainda usa. Essa é a régua.',
      cta: '',
      createdOn: '2026-08-14',
    },
    comments: [],
  },
  {
    id: 'static-001',
    reference: 'ESTÁTICO 001',
    title: 'Convite para o ateliê',
    channel: 'instagram',
    format: 'static',
    status: 'changes_requested',
    objective: 'Levar gente ao espaço físico',
    territory: 'Ofício',
    scheduledFor: '2026-09-18T10:00:00-03:00',
    previewTone: 'bone',
    versionCount: 2,
    currentVersion: {
      version: 2,
      hook: 'Sábado, das 10 às 16. Entra sem marcar.',
      caption: 'O ateliê fica aberto no primeiro sábado do mês. Sem hora marcada, sem compromisso.',
      cta: 'Endereço na bio.',
      createdOn: '2026-08-27',
    },
    comments: [
      {
        id: 'c3',
        author: 'Marta · Hartmann',
        authorSide: 'client',
        body: 'O horário mudou: passou a ser das 11 às 17. Dá para ajustar?',
        createdOn: '2026-08-28',
      },
    ],
  },
]

export const STRATEGY: Strategy = {
  clientName: 'Hartmann',
  title: 'Direção editorial',
  period: 'Setembro 2026',
  version: 2,
  status: 'approved',
  chapters: [
    {
      number: '01',
      title: 'O que entendemos',
      lead: 'A Hartmann não vende joia. Vende a decisão de ter uma peça para a vida inteira.',
      body: [
        'Na imersão ficou claro que a marca nasceu de uma recusa: nenhuma das duas fundadoras encontrava peças que resistissem ao uso diário sem parecer descartáveis.',
        'Essa recusa é o ativo mais forte que vocês têm, e hoje ela não aparece em lugar nenhum da comunicação. O perfil mostra produto; não mostra critério.',
      ],
    },
    {
      number: '02',
      title: 'A oportunidade',
      lead: 'A categoria fala de desejo. Quase ninguém fala de critério.',
      body: [
        'Analisamos catorze marcas concorrentes. Doze comunicam exclusivamente aspiração: fotografia de produto, luz difusa, pouca informação.',
        'Existe um espaço vazio para quem explicar como se escolhe uma joia. Quem ensina vira referência, e referência é o que sustenta preço.',
      ],
    },
    {
      number: '03',
      title: 'Público',
      lead: 'Mulheres que compram poucas peças e querem acertar.',
      body: [
        'O núcleo tem entre 28 e 45 anos, compra joia duas ou três vezes por ano e pesquisa bastante antes de decidir.',
        'Ela não quer ser convencida. Quer ter informação suficiente para se convencer sozinha.',
      ],
    },
    {
      number: '04',
      title: 'Posicionamento',
      lead: 'A joalheria que explica suas escolhas.',
      body: [
        'Tudo que a Hartmann publica deve deixar a pessoa mais capaz de decidir — inclusive de decidir não comprar agora.',
        'É uma postura incomum na categoria e é ela que vai separar vocês do resto.',
      ],
    },
    {
      number: '05',
      title: 'Territórios editoriais',
      lead: 'Três territórios, e nada fora deles.',
      body: [],
      items: [
        {
          label: 'Universo Hartmann',
          description: 'Quem são vocês, por que a marca existe, o que vocês recusam fazer.',
        },
        {
          label: 'Guia Hartmann',
          description: 'Conteúdo que ensina a escolher: medida, metal, proporção, manutenção.',
        },
        {
          label: 'Ofício',
          description: 'A bancada, as etapas, o tempo. O que justifica o preço sem falar de preço.',
        },
      ],
    },
    {
      number: '06',
      title: 'Direção criativa',
      lead: 'Mão, mesa, luz de janela.',
      body: [
        'Fotografia com a peça sendo usada ou sendo feita, nunca isolada em fundo infinito.',
        'Tipografia sóbria, pouco texto sobre imagem, e a voz de vocês em primeira pessoa.',
      ],
    },
    {
      number: '07',
      title: 'Séries',
      lead: 'Formatos que se repetem para criar hábito.',
      body: [],
      items: [
        { label: 'Onze etapas', description: 'Uma etapa da produção por mês, em vídeo curto.' },
        { label: 'Pergunta de sábado', description: 'Uma dúvida real de cliente, respondida.' },
        { label: 'Peça com história', description: 'Uma cliente conta o que a peça marca.' },
      ],
    },
    {
      number: '08',
      title: 'Experimentos',
      lead: 'Duas apostas para o ciclo 1.',
      body: [],
      items: [
        {
          label: 'Fundadoras em cena',
          description: 'Hipótese: presença humana aumenta compartilhamento. Medimos em 30 dias.',
        },
        {
          label: 'Carrossel didático longo',
          description: 'Hipótese: mais slides aumenta salvamento sem perder alcance.',
        },
      ],
    },
    {
      number: '09',
      title: 'Métricas',
      lead: 'O que vamos olhar, e o que vamos ignorar.',
      body: [
        'Compartilhamentos e salvamentos são os sinais que importam: indicam que o conteúdo foi útil o suficiente para ser guardado ou passado adiante.',
        'Curtida não entra em nenhuma decisão. Seguidores só interessam se vierem acompanhados de salvamento.',
      ],
    },
  ],
}

export const ONBOARDING: OnboardingSection[] = [
  {
    key: 'brand',
    index: 1,
    title: 'A marca',
    lead: 'Antes de falar sobre conteúdo, queremos entender uma coisa.',
    questions: [
      {
        key: 'why',
        label: 'Por que a Hartmann precisa existir?',
        help: 'Sem discurso de marketing. Do jeito que vocês contariam para uma amiga.',
        type: 'long_text',
        placeholder: 'Escreva à vontade…',
      },
      {
        key: 'refuse',
        label: 'O que vocês se recusam a fazer?',
        type: 'long_text',
        placeholder: 'O que está fora de questão, mesmo que dê dinheiro.',
      },
    ],
  },
  {
    key: 'business',
    index: 2,
    title: 'O negócio',
    lead: 'Agora a parte prática. Sem isso, a estratégia vira palpite.',
    questions: [
      {
        key: 'revenue',
        label: 'De onde vem a maior parte da receita hoje?',
        type: 'single_select',
        options: ['Loja física', 'Instagram', 'Site próprio', 'Encomendas diretas', 'Revenda'],
      },
      {
        key: 'goal',
        label: 'O que precisa acontecer nos próximos seis meses?',
        type: 'long_text',
        placeholder: 'O resultado concreto, não a intenção.',
      },
    ],
  },
  {
    key: 'customer',
    index: 3,
    title: 'O cliente',
    lead: 'Quem já compra costuma explicar melhor a marca do que qualquer pesquisa.',
    questions: [
      {
        key: 'who',
        label: 'Descreva a última pessoa que comprou de vocês.',
        type: 'long_text',
        placeholder: 'Quem era, o que levou, por quê.',
      },
      {
        key: 'objection',
        label: 'Qual é a objeção que mais aparece?',
        type: 'short_text',
        placeholder: 'A frase que vocês mais ouvem antes do "vou pensar".',
      },
    ],
  },
  {
    key: 'perception',
    index: 4,
    title: 'Percepção',
    lead: 'O que as pessoas acham hoje é o ponto de partida do que vamos construir.',
    questions: [
      {
        key: 'said',
        label: 'Qual elogio vocês mais escutam?',
        type: 'short_text',
      },
      {
        key: 'wrong',
        label: 'O que as pessoas entendem errado sobre a Hartmann?',
        type: 'long_text',
      },
    ],
  },
  {
    key: 'references',
    index: 5,
    title: 'Referências',
    lead: 'Referência não é para copiar. É para calibrar o que vocês gostam.',
    questions: [
      {
        key: 'admire',
        label: 'Três marcas que vocês admiram — de qualquer categoria.',
        type: 'long_text',
      },
      {
        key: 'avoid',
        label: 'Uma marca que vocês não querem parecer.',
        type: 'short_text',
      },
    ],
  },
  {
    key: 'materials',
    index: 6,
    title: 'Materiais',
    lead: 'Por último, o que vocês já têm pronto.',
    questions: [
      {
        key: 'drive',
        label: 'Link para fotos, catálogo ou manual de marca',
        type: 'url',
        placeholder: 'https://',
      },
      {
        key: 'anything',
        label: 'Alguma coisa que a gente não perguntou e deveria ter perguntado?',
        type: 'long_text',
      },
    ],
  },
]

export const RESULTS: ResultsPeriod = {
  period: 'Agosto 2026',
  metrics: [
    { key: 'reach', value: '83.421', label: 'pessoas alcançadas', delta: '+34% vs. julho' },
    { key: 'followers', value: '+492', label: 'novos seguidores', delta: '+18% vs. julho' },
    { key: 'shares', value: '1.840', label: 'compartilhamentos', delta: '+2,4× vs. julho' },
  ],
  whatHappened:
    'Publicamos oito peças no ciclo zero, metade com as fundadoras em cena e metade só com produto. Era um teste, e ele respondeu rápido.',
  whatWorked: [
    {
      title: 'As fundadoras em cena',
      detail:
        'As quatro peças com Cecília e Marta somaram 1.312 compartilhamentos. As quatro só de produto somaram 528.',
    },
    {
      title: 'Carrossel didático',
      detail:
        '"O que significa ouro 18k" foi salvo 611 vezes — mais que as outras sete peças somadas.',
    },
  ],
  whatDidNot: [
    {
      title: 'Foto de produto isolada',
      detail:
        'Alcance na média, quase nenhum compartilhamento. É bonito e não move ninguém. Sai do ciclo 1.',
    },
  ],
  learnings: [
    {
      id: 'l1',
      headline: 'Presença humana é o que faz a peça circular.',
      detail:
        'Não é o produto que as pessoas compartilham: é a história de quem faz. O ciclo 1 dobra a aposta nisso.',
      evidence: 'Base: 8 publicações entre 12/08 e 28/08.',
    },
    {
      id: 'l2',
      headline: 'Quem salva hoje compra depois.',
      detail:
        'Três das cinco encomendas de agosto vieram de pessoas que tinham salvado o carrossel de ouro 18k. Salvamento virou métrica principal.',
    },
  ],
  whatChanges: [
    'Oito das doze peças do ciclo 1 têm as fundadoras em cena.',
    'A série "Onze etapas" estreia em setembro.',
    'Foto de produto isolada sai da grade.',
  ],
}

export const FILES: ProjectFile[] = [
  {
    id: 'f1',
    name: 'Direção editorial · Setembro 2026',
    category: 'strategy',
    kind: 'PDF',
    sizeLabel: '2,4 MB',
    addedOn: '2026-08-26',
  },
  {
    id: 'f2',
    name: 'Manual de marca Hartmann',
    category: 'brand',
    kind: 'PDF',
    sizeLabel: '8,1 MB',
    addedOn: '2026-07-24',
  },
  {
    id: 'f3',
    name: 'Ciclo 1 · artes aprovadas',
    category: 'content',
    kind: 'Pasta',
    sizeLabel: '12 arquivos',
    addedOn: '2026-08-30',
  },
  {
    id: 'f4',
    name: 'Pesquisa de categoria',
    category: 'reference',
    kind: 'PDF',
    sizeLabel: '5,7 MB',
    addedOn: '2026-08-07',
  },
  {
    id: 'f5',
    name: 'Fotografia · bancada',
    category: 'reference',
    kind: 'Pasta',
    sizeLabel: '48 arquivos',
    addedOn: '2026-08-19',
  },
]

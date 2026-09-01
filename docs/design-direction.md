# Direção de arte — Boop OS

O raciocínio por trás do sistema visual. Os valores estão em
[`design-system.md`](design-system.md); o movimento, em [`motion.md`](motion.md).

Fontes, na ordem de autoridade que a FASE 1.5 seguiu: assets oficiais em
`reference/brand/` → `README.md` da marca → `TYPOGRAPHY.md` → apresentação
institucional → `UI-REFERENCE.md`.

---

## O que a marca é

Três leituras dos materiais oficiais orientam tudo o que vem abaixo.

**A logo é um par de olhos.** Os dois "o" de _boop_ são olhos — um navy, um
azul, com topete e um chifrinho. Não é um símbolo abstrato ao lado de um
logotipo: é um personagem olhando para fora da tela.

**A metáfora da marca é esculpir.** A apresentação institucional é inteira de
pedreira, blocos de mármore e escultura. A frase central — _"nós não
construímos coisas genéricas"_ — aparece sobre fileiras de blocos idênticos. O
mercado produz em série; a Boop talha.

**O princípio é declarado pela própria Boop:** _"estratégia antes de estética"_.
Substância antes de superfície.

## O conceito: ateliê aberto

O portal é a janela do ateliê. O cliente vê o que está na bancada, o que já foi
talhado e o que vem depois — sem precisar perguntar.

Isso resolve a ponte entre marca e produto: a promessa do Boop OS é _"eu sei
exatamente o que está acontecendo com minha marca"_, e o símbolo da Boop já é
**atenção**. Os olhos não decoram a interface. Eles olham para o cliente
exatamente quando alguma coisa depende dele.

### O teste

> Se eu remover a logo, isto ainda parece Boop?

O que responde "sim" não é o azul. São quatro decisões:

1. **Lajes editoriais, não cards.** A apresentação é feita de blocos de cor
   cheia e faixas de largura total. O portal também: as seções são lajes
   separadas por cor e por filete, não caixas flutuantes com sombra.
2. **Off-white quente, nunca branco puro.** `#FFFDF5` vem do próprio SVG da
   marca. É o que faz a tela parecer impressa em vez de iluminada, e é o
   detalhe que mais separa o portal de um dashboard genérico.
3. **Tipografia como estrutura.** Poppins Bold em escala de cartaz contra
   metadados minúsculos com tracking aberto. O contraste entre os dois extremos
   é o ritmo da marca.
4. **Quase sem raio.** Blocos praticamente retos. "Moderno = arredondado" é
   convenção de template, não da Boop.

## Composição

**Assimétrica e alinhada à esquerda.** A referência externa centraliza tudo;
centralizar é o gesto que faz qualquer tela parecer landing page. As manchetes
começam na margem esquerda e o texto quebra em bandeira.

**Alternância de lajes.** A leitura vertical alterna fundo claro → laje
atmosférica → fundo claro → laje navy. É o que dá ritmo sem precisar de bordas.

**Espaço negativo é conteúdo.** Blocos respiram em 56–96px de altura interna.
Bloco vazio desaparece; nunca vira card de "nenhum item".

**Grid.** Conteúdo em 1180px, faixas editoriais em 1440px, calha de 20px no
celular e 40px a partir de 768px. Colunas assimétricas onde há hierarquia —
`0.85fr / 1fr` no detalhe de conteúdo, `1.15fr / 0.85fr` no login.

## Cor

O azul da Boop funciona como **estrutura e sinal**, não como "cor do botão".

- **Azul `#00C2FF`** — cor gráfica: o filete da navegação ativa, o bloco da
  etapa corrente, o número que precisa de atenção, o anel de foco no escuro.
- **Navy `#0B1B2C`** — tinta e superfície inversa. É a laje de atenção.
- **Slate `#7488A3`** — o azul atmosférico da apresentação. Grandes superfícies
  de abertura e a laje de aprendizado.
- **Off-white `#FFFDF5`** e **bone `#E3DCCC`** — os dois fundos.

**A restrição que definiu o botão.** `#00C2FF` tem 2.03:1 contra off-white: ele
reprova como texto em fundo claro _e_ reprova com texto branco por cima. A saída
acessível é azul com texto **navy** — 8.42:1 — que é exatamente a combinação da
logo. A limitação virou assinatura. Detalhes e teste em
[`design-system.md`](design-system.md#contraste).

## Tipografia

Poppins, quatro pesos. Bold (700) é o peso de expressão da marca e aparece em
display, seções, números e momentos editoriais — nunca em tudo.

O gesto característico é o **par**: um metadado de 11px em caixa alta com
tracking de 0.16em imediatamente acima de um título de 52px com tracking
negativo. Escala completa em [`design-system.md`](design-system.md#tipografia).

Caixa alta só em display curto, metadado e rótulo. Nunca em parágrafo.

## Nuvens

Atmosfera, não adesivo.

**Onde entram:** login, boas-vindas, abertura de estratégia, laje de atenção,
momento de aprovação, estados vazios e conclusão. São limiares — momentos em que
alguém chega, decide ou termina.

**Onde não entram:** lista de conteúdo, formulários, tabela de arquivos,
estratégia longa, qualquer área operacional densa.

**Como se comportam:** sempre atrás do conteúdo, `pointer-events-none`,
`aria-hidden`, opacidade entre 0.16 e 0.30, deriva de 34–52s com amplitude
menor que 2%. Percebe-se de canto de olho; nunca compete com a leitura.

Três densidades: `single` (uma nuvem), `pair` (duas) e `horizon` (duas na base,
para abertura).

## Mascote

Aparição, não companhia.

O mascote é o asset oficial, com a geometria intacta. A única liberdade tomada
foi isolar as pupilas em um grupo próprio, para que o olhar possa se deslocar —
e isso existe porque o olhar **significa** alguma coisa no produto.

| Onde                          | O que comunica                                                      |
| ----------------------------- | ------------------------------------------------------------------- |
| Laje "precisa da sua atenção" | Olha para baixo, na direção do número. É o gesto central do produto |
| Etapa corrente da jornada     | Olha para o bloco que está sendo trabalhado                         |
| Boas-vindas                   | Se apresenta. É a única vez que aparece sem função utilitária       |
| Espera (`Spinner`)            | Pisca devagar                                                       |
| Estado vazio                  | Ocupa o lugar do que ainda não existe                               |
| Aprovação e conclusão         | Fecha o momento                                                     |

**Onde não aparece:** navegação, listas, formulários, estratégia, resultados,
qualquer lugar em que viraria enfeite. Se o mascote aparece em toda tela, ele
para de significar.

## Microcopy

Curta, humana, direta, segura. A voz da apresentação: frases afirmativas,
sem jargão, sem entusiasmo artificial.

- **Sim:** "Aguardando você." · "Agora é com a gente." · "Ainda não temos
  resultados por aqui. Estamos coletando os primeiros sinais."
- **Não:** "Nenhum dado disponível." · "status: awaiting_client" · "Ops!" ·
  qualquer exclamação em erro.

Erro leve pode ter personalidade. Erro que envolve perda de dado, aprovação ou
segurança é objetivo, sempre.

## Sim e não

| Sim                                  | Não                                 |
| ------------------------------------ | ----------------------------------- |
| Lajes de cor cheia, largura total    | Cards flutuantes com sombra         |
| Filete de 1px onde separa de verdade | Borda em volta de todo container    |
| Hierarquia por escala e espaço       | Hierarquia por caixa e cor de fundo |
| Off-white quente                     | Branco puro, cinza neutro           |
| Raio de 0–4px                        | `rounded-2xl` em tudo               |
| Status como ponto + rótulo           | Pill colorida                       |
| Seta tipográfica (→)                 | Biblioteca de ícones                |
| Número gigante                       | Gráfico decorativo                  |
| Nuvem em limiar                      | Céu de fundo em toda página         |
| Olhos com função                     | Mascote conversando                 |

## Débito de design assumido

- **Fotografia.** A apresentação da Boop é sustentada por fotografia editorial
  (pedreira, bancada, escultura). O portal ainda não tem nenhuma — os previews
  de conteúdo compõem com tipografia sobre cor. É honesto, mas fotografia real
  elevaria o resultado, e é a maior oportunidade da próxima rodada.
- **Sem tema escuro.** O sistema de tokens já é uma camada só de variáveis;
  acrescentar o tema é redefinir valores, não tocar componentes.
- **Preview de conteúdo é tipográfico.** Vira `<Image>`/`<video>` quando houver
  mídia, mantendo a proporção.

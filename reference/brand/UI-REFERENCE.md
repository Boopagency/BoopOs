# Boop OS — UI / Motion Inspiration Reference

Este documento registra uma referência externa de interface fornecida para orientar **atmosfera, composição, motion e nível de acabamento** do BOOP OS.

## Regra principal

Esta referência **NÃO é uma especificação técnica para copiar literalmente**.

O BOOP OS já possui stack, arquitetura, identidade e regras próprias.

Portanto, NÃO substituir:

- Next.js por Vite;
- stack atual por outra;
- tipografia Boop por Instrument Serif ou Inter;
- identidade visual Boop pela identidade da referência;
- arquitetura de navegação definida pelo projeto;
- componentes existentes por shadcn sem necessidade.

A referência deve ser interpretada como **direção de experiência**.

---

## O que queremos absorver da referência

### 1. Sensação cinematográfica

- presença visual forte;
- composição com poucos elementos;
- grande uso de espaço;
- tipografia protagonista;
- atmosfera premium;
- sensação de profundidade.

### 2. Navegação refinada

A referência utiliza navegação leve e translúcida.

No BOOP OS podemos explorar, quando fizer sentido:

- superfícies translúcidas;
- blur muito sutil;
- bordas de luz discretas;
- navegação flutuante;
- sensação de camada sobre o conteúdo.

Não aplicar glassmorphism indiscriminadamente.

### 3. Motion

A referência utiliza entrada com:

- fade;
- translate vertical;
- delays progressivos;
- movimentos curtos e suaves.

Esse princípio é bem-vindo no BOOP OS.

Exemplo conceitual:

headline
→ entra primeiro;

subtexto
→ entra depois;

ação
→ entra por último.

O motion deve ser rápido, elegante e funcional.

### 4. Tipografia em grande escala

A referência trabalha headline muito grande e forte.

No BOOP OS, traduzir isso usando a identidade oficial:

**Poppins Bold**, não Instrument Serif.

Aplicar principalmente em:

- login/welcome;
- dashboard hero;
- abertura de estratégia;
- resultados;
- momentos de conclusão.

### 5. Minimalismo com impacto

Poucos elementos, mas cada um com peso visual.

Evitar:

- excesso de cards;
- excesso de badges;
- informação disputando atenção;
- decoração sem função.

---

## Vídeo como background

A referência utiliza vídeo fullscreen.

No BOOP OS, vídeo **não deve virar padrão do sistema**.

Pode ser avaliado somente em momentos especiais, como:

- login;
- welcome;
- apresentação institucional;
- algum estado editorial muito específico.

Não utilizar vídeo de fundo em:

- calendário;
- aprovação de conteúdo;
- formulários;
- estratégia longa;
- resultados;
- áreas operacionais.

Motivos:

- performance;
- acessibilidade;
- distração;
- consumo de dados;
- usabilidade mobile.

Se vídeo for utilizado:

- `autoPlay`;
- `loop`;
- `muted`;
- `playsInline`;
- `object-cover`;
- fallback estático;
- otimização de peso;
- respeito a reduced motion e economia de dados quando possível.

---

## Liquid Glass

A referência utiliza um efeito chamado `liquid-glass`.

O conceito pode inspirar componentes específicos, mas não deve virar a linguagem inteira do produto.

Possíveis aplicações:

- navegação;
- CTA especial;
- floating action;
- overlay de aprovação;
- pequenos elementos sobre imagem.

Evitar em:

- todos os cards;
- tabelas;
- formulários;
- conteúdo longo.

Priorizar contraste e legibilidade.

---

## Direção de motion para a Boop

A ideia de `fade-rise` combina com a direção pretendida.

Princípio inicial:

- movimento vertical curto;
- opacity de 0 → 1;
- distância pequena;
- duração aproximada de 500–800ms para momentos editoriais;
- ações comuns mais rápidas;
- delays apenas quando criam narrativa.

Nunca atrasar artificialmente o uso da interface.

---

## Como traduzir para a identidade Boop

Trocar a atmosfera da referência pela linguagem própria:

### Em vez de:
background abstrato/cinemático genérico

### Usar:
- céu;
- nuvens;
- azul Boop;
- deep navy;
- fotografia editorial Boop;
- mascote/olhinhos;
- elementos gráficos oficiais.

### Em vez de:
Instrument Serif

### Usar:
**Poppins / Poppins Bold**

### Em vez de:
interface de landing page

### Criar:
produto operacional com direção editorial.

---

## Onde esta referência é mais útil

Prioridade alta:

1. Login
2. Welcome
3. Dashboard hero
4. Estratégia — opening sections
5. Approval success
6. Results / Monthly Review

Prioridade baixa:

- formulários extensos;
- listas;
- configurações;
- admin;
- conteúdo operacional denso.

---

## Critério de sucesso

Ao estudar esta referência, não queremos que o BOOP OS pareça com ela.

Queremos absorver o que ela faz bem:

- impacto;
- respiro;
- hierarquia;
- motion;
- atmosfera;
- refinamento.

E reinterpretar isso dentro de uma interface que seja inequivocamente Boop.

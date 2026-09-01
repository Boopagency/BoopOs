# Boop — Typography Reference

Este documento define a direção tipográfica oficial da Boop para o BOOP OS e demais produtos digitais.

## Fonte principal

**Poppins**

A Poppins é a fonte principal da identidade Boop e deve ser tratada como a base tipográfica do produto.

### Peso principal da marca

**Bold — 700**

O peso Bold deve ter protagonismo em:

- headlines;
- títulos de seção;
- números de destaque;
- chamadas editoriais;
- momentos de impacto;
- labels curtos que façam parte da direção de arte.

A identidade da Boop depende bastante de tipografia forte, direta e visualmente presente.

---

## Uso no BOOP OS

O sistema deve manter a personalidade da marca sem comprometer legibilidade.

### Display / Editorial

Usar **Poppins Bold (700)**.

Aplicações:

- hero;
- welcome;
- dashboard headline;
- títulos de estratégia;
- números importantes;
- momentos editoriais;
- empty states de destaque;
- mensagens de conclusão.

### UI / Interface

Preferencialmente usar Poppins em pesos mais leves quando necessário para leitura, mantendo Bold para hierarquia.

Sugestão inicial:

- 400 — body e textos longos;
- 500 — labels, navegação e controles;
- 600 — subtítulos e ações;
- 700 — headlines e elementos de marca.

Se algum desses pesos não estiver disponível/licenciado na implementação, documentar a decisão antes de substituir.

---

## Princípios

A tipografia deve parecer:

- confiante;
- direta;
- editorial;
- moderna;
- clara;
- com personalidade.

Evitar:

- excesso de texto em caixa alta;
- títulos pequenos demais;
- hierarquia baseada apenas em cor;
- usar Bold em absolutamente tudo;
- tipografia com aparência genérica de dashboard SaaS;
- misturar famílias tipográficas sem necessidade.

---

## Escala inicial sugerida

Valores são ponto de partida e podem ser refinados durante o design system.

### Metadata
11–13px  
Peso 500–600

### UI / Body
14–17px  
Peso 400–500

### Functional Heading
20–32px  
Peso 600–700

### Section Heading
32–52px  
Peso 700

### Editorial Display
48–88px desktop  
Peso 700

No mobile, utilizar escala responsiva e `clamp()` quando apropriado.

---

## Tracking

Poppins Bold pode funcionar melhor com tracking levemente mais fechado em títulos grandes.

Não aplicar valores extremos.

Ajustar visualmente conforme:

- tamanho;
- largura disponível;
- breakpoint;
- quantidade de palavras.

Body text deve preservar excelente leitura.

---

## Line Height

### Display
Mais compacto, aproximadamente 0.95–1.05 quando visualmente adequado.

### Títulos funcionais
1.05–1.2.

### Body
1.45–1.7.

Não sacrificar leitura por estética.

---

## Caixa alta

Caixa alta pode ser usada como recurso editorial em:

- metadata;
- chapter labels;
- status curtos;
- pequenos títulos de seção.

Evitar grandes parágrafos ou headings longos em caixa alta.

---

## Relação com a identidade visual

A tipografia deve trabalhar junto de:

- azul Boop;
- deep navy;
- off-white;
- nuvens;
- mascote/olhinhos;
- fotografia;
- grandes áreas de respiro.

Poppins Bold não deve ser apenas uma fonte aplicada sobre um dashboard genérico.

Ela deve participar da composição.

---

## Importante para o Claude Code

- **Poppins é a fonte oficial/principal da Boop.**
- **Poppins Bold (700) é o principal peso de expressão da marca.**
- Não substituir por Instrument Serif, Inter ou outra família apenas porque aparece em uma referência externa.
- Referências externas servem para estudar composição, ritmo, motion e atmosfera — não para sobrescrever a identidade tipográfica Boop.
- Usar `next/font` ou estratégia equivalente adequada ao projeto.
- Não adicionar arquivos de fonte licenciados ao repositório sem autorização.
- Se utilizar Google Fonts, carregar apenas os pesos realmente usados e otimizar performance.

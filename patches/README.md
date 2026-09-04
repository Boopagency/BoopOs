# patches/

Regra 7 do [`CLAUDE.md`](../CLAUDE.md): _"o container de trabalho é efêmero; o
patch é o que sobrevive a ele"_.

| Arquivo                      | O que é                                   |
| ---------------------------- | ----------------------------------------- |
| `0001…000N-*.patch`          | os commits da **fase corrente**, na ordem |
| `boop-os-full-history.patch` | o repositório inteiro desde o commit raiz |

Os numerados são substituídos a cada fase; o histórico completo é regerado.

## Como restaurar

**Só a fase**, sobre a ponta da fase anterior:

```bash
git am patches/000*.patch
```

**Tudo, do zero**, num diretório vazio:

```bash
git init . && git am patches/boop-os-full-history.patch
```

Depois: `pnpm install`, `pnpm db:start`, `pnpm db:reset`.

## `boop-os-full-history.patch` NÃO inclui esta pasta

A partir da FASE 7 ele é gerado com `-- . ':(exclude)patches'`, e a razão é
aritmética: o patch de histórico de cada fase passou a **conter os patches da
fase anterior**, que continham os da anterior, e assim por diante.

| Fase | Tamanho | Do qual é patch-dentro-de-patch |
| ---- | ------- | ------------------------------- |
| 6    | 22 MB   | —                               |
| 7    | 29 MB   | 22 MB (76%)                     |
| 8    | 7,8 MB  | **zero** — a exclusão funcionou |
| 8.5  | 7,5 MB  | **zero**                        |
| 9    | ~8 MB   | projetado, crescendo com código |

A FASE 8.5 quase perdeu isso: a regeneração foi feita **sem** o pathspec, e o
patch voltou a 164 MB — grande o bastante para o GitHub recusar o push, o que
foi como o erro apareceu. O comando correto está acima, e não é opcional:

```bash
git format-patch --root HEAD --stdout -- . ':(exclude)patches'
```

Excluindo a pasta, o histórico real do código-fonte era **7,1 MB** ao fim da
FASE 7 e são **7,8 MB** ao fim da FASE 8 — o crescimento voltou a ser o do
código, como previsto.

Nada se perde. Um patch que reconstrói arquivos de patch é circular: quem
restaura a partir daqui recebe as 317 fontes rastreadas — verificado byte a byte
contra `git ls-tree` — e pode regerar os patches com um `git format-patch`.

Duas consequências que quem restaura precisa saber:

- **53 commits** ao fim da FASE 8.5 (eram 47 na FASE 8). Os commits que tocaram
  _exclusivamente_ `patches/` viram patch vazio e são omitidos. Eles não
  continham código. As 332 fontes rastreadas estão todas lá.
- **A pasta `patches/` não existe** no repositório restaurado, até a próxima
  fase gerá-la de novo.

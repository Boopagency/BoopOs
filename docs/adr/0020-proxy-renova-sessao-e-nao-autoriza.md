# ADR-0020 — `proxy.ts` existe, renova sessão e não autoriza

**Status:** aceito · **Data:** 2026-09-02 · **Fase:** 3

## Contexto

O `@supabase/ssr` precisa renovar o token em algum lugar antes de a página
renderizar: um Server Component não pode escrever cookie, então uma sessão
renovada durante o render se perde e a pessoa é deslogada sozinha. O padrão
documentado pelo Supabase usa o middleware do framework.

O Next 16 empurra na direção contrária. O arquivo foi renomeado de
`middleware.ts` para `proxy.ts`, a função exportada passou de `middleware` para
`proxy`, e a documentação diz explicitamente para "evitar depender de Middleware
a menos que não exista outra opção". A [I-14](../spec-review.md) deixou a
decisão para esta fase.

Há ainda o histórico: a CVE-2025-29927 foi uma classe de bypass de middleware no
próprio Next. E a documentação do Next 16 acrescenta um detalhe que decide a
questão — **uma Server Function é um POST para a rota onde ela vive**, então um
`matcher` que exclua um caminho também deixa de cobrir as Server Actions dali.
Uma refatoração que mova uma action de rota pode remover a cobertura do proxy
sem ninguém perceber.

## Decisão

O arquivo existe, com escopo mínimo e uma responsabilidade:

1. renovar o cookie de sessão (`getUser()`, que valida o token no servidor de
   Auth, não `getSession()`, que apenas decodifica o cookie);
2. redirecionar quem não tem sessão em rota protegida, preservando o destino
   em `?next=`.

E uma proibição: **o proxy não decide autorização.** Nada de vínculo, papel,
consulta de domínio, `service_role` ou regra de negócio. A proteção efetiva é
`requireActor()` no servidor de render — que roda para toda rota do grupo, em
todo request — mais a RLS no banco a partir da FASE 4.

## Alternativas consideradas

| Alternativa                               | Por que não                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Renovar dentro de cada rota               | Espalha a responsabilidade por dezenas de arquivos; uma rota nova nasce sem refresh e o sintoma (logout aleatório) aparece semanas depois |
| Renovar só no layout do portal            | `/admin` e qualquer rota futura fora do portal ficariam sem renovação — o mesmo problema, adiado                                          |
| Autorizar no proxy (mais rápido)          | É exatamente o que a CVE-2025-29927 explorou; e o `matcher` é frágil por design, como a própria documentação do Next avisa                |
| Não ter o arquivo, aceitando sessão curta | A pessoa é deslogada quando o token expira no meio do uso. Não é uma decisão de arquitetura, é um defeito                                 |

## Consequências

- Uma responsabilidade só, e ela é verificável em uma leitura de trinta linhas.
- O `matcher` exclui apenas assets (`_next/static`, `_next/image`, favicon,
  extensões de arquivo). Toda rota de aplicação passa, inclusive as públicas —
  elas também precisam do refresh.
- Como o proxy não é fronteira de segurança, mudar o `matcher` não abre buraco:
  no pior caso a sessão não é renovada e a pessoa cai no login.
- O proxy roda em Node.js por padrão no Next 16, e a opção `runtime` não é
  aceita nesse arquivo — declará-la dá erro.
- Sem Supabase configurado o arquivo continua funcionando: ninguém tem sessão,
  rota protegida vai para `/login`, o resto segue público (ADR-0017).

## Gatilho de revisão

O Next remover o arquivo de vez, ou o `@supabase/ssr` passar a renovar a sessão
por outro mecanismo que não dependa de interceptar o request.

# Regras — Segurança

Raciocínio em [`docs/security.md`](../../docs/security.md). Aqui só o que é obrigatório.

## Inegociável

1. Dado de um cliente **nunca** alcança outro cliente.
2. Duas camadas sempre: autorização na aplicação **e** RLS no banco. Nenhuma
   sozinha é suficiente.
3. `service_role` só em `src/lib/supabase/admin.ts`, que começa com
   `import 'server-only'`. Nunca `NEXT_PUBLIC_`. Nunca em Client Component.
4. Server Action é endpoint público. Toda action passa por `defineWorkflow`, que
   valida, autentica e autoriza — nesta ordem, sem exceção.
5. `proxy.ts` renova sessão e redireciona. **Não decide autorização.** No Next
   16 o arquivo se chama `proxy.ts` e a função exportada é `proxy`;
   `middleware.ts` está depreciado ([I-14](../../docs/spec-review.md)).

## Toda escrita

- Input por zod `.strict()`. Campo desconhecido é rejeitado.
- `clientId`/`projectId` do payload são **sugestão**, nunca autorização: derive do
  recurso e confirme no banco.
- Releia o estado do banco antes de decidir. Nunca confie no estado que a UI mandou.
- Recurso inacessível responde **404**, não 403.

## Erros e logs

- Nunca devolver ao cliente: stack trace, SQL, nome de tabela, valor de env.
- Nunca logar: token, senha, cookie, `Authorization`, `service_role`, signed URL,
  corpo de e-mail, resposta de onboarding, legenda de conteúdo.
- `activity_log.metadata` guarda **identificadores e transições**, nunca conteúdo.

## Arquivos

- Bucket privado. Zero policy pública em `storage.objects`.
- MIME na whitelist (`png`, `jpeg`, `webp`, `mp4`, `pdf`). **SVG bloqueado.**
- Revalide MIME e tamanho **no servidor, depois do upload**. O cliente mente antes.
- Autorização vem da tabela `files`, nunca do path.
- Signed URL: TTL curto, gerada sob demanda, nunca cacheada, nunca logada.

## O que o cliente nunca pode ver

Conteúdo em `idea`, `planned`, `in_production` ou `internal_review`; comentário
com `is_internal = true`; `internal_notes` de versão; arquivo com
`visibility = 'internal'`; `clients.notes`; activity log; qualquer dado de outro
cliente.

Se você escreveu uma query nova no portal, confira essa lista.

## Antes de abrir o PR

- [ ] Tabela nova com RLS e quatro políticas
- [ ] Toda policy de UPDATE com `USING` **e** `WITH CHECK`
- [ ] Action nova passando por `defineWorkflow`
- [ ] Teste de isolamento cobrindo o caminho novo
- [ ] Nenhum log novo com PII, token ou signed URL

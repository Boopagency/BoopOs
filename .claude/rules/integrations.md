# Regras — Integrações

Raciocínio em [`docs/integrations.md`](../../docs/integrations.md).

## Inegociável

**Nenhuma integração externa é dependência do produto.** Se Resend e Notion
caírem juntos, o cliente entra, vê o projeto e aprova conteúdo normalmente.

- Falha de integração **nunca** derruba operação de domínio.
- Falha de integração **nunca** é silenciosa: registra em `notifications` (e-mail)
  ou `integration_events` (Notion), e no activity log.
- A aplicação sobe e funciona com `RESEND_API_KEY` e `NOTION_API_KEY` ausentes.

## Isolamento

- SDK externo só é importado dentro de `src/lib/integrations/<nome>`. Nenhum
  domínio importa `resend` ou `@notionhq/client` direto.
- O domínio depende da interface (`EmailService`, `NotionAdapter`), nunca do SDK.
- Chamada externa **nunca** acontece dentro de transação de domínio. Sempre depois
  do commit, via `ctx.after()`.

## E-mail

- Todo envio grava linha em `notifications` **antes** de tentar: `pending` →
  `sent` | `failed`.
- `dedupe_key` obrigatório. Reexecutar o workflow não dispara e-mail duplicado.
- Nenhum e-mail carrega dado sensível: contexto mínimo e link para o sistema.
- Fora de produção, allowlist de destinatário. **Nenhum e-mail de teste pode
  alcançar um cliente real.**
- `EMAIL_DRY_RUN=true` em desenvolvimento.

## Notion (FASE 17)

- Unidirecional: Boop OS → Notion. **Nunca** o contrário.
- Notion não é banco. Nenhuma leitura de domínio vem de lá.
- Mapeamento entidade → página em `integration_events.external_id`.

## Integração nova

1. ADR antes do código: qual problema, por que agora, o que acontece se cair.
2. Adapter isolado com interface própria.
3. Nenhuma escrita de domínio dependendo do serviço externo.
4. Falha registrada, nunca fatal.
5. Segredo server-side, documentado em `.env.example`.
6. A aplicação sobe com a variável ausente.

## Proibido

- n8n, ou qualquer orquestrador externo. Automação é código TypeScript neste
  repositório.
- Webhook de entrada sem verificação de assinatura.
- Segredo de integração fora de `.env` e do painel da Vercel.

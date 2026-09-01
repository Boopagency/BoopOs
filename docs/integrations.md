# Integrações — Boop OS

Princípio: **nenhuma integração externa é dependência do produto.** Se Resend,
Notion e qualquer outro serviço caírem juntos, o Boop OS continua funcionando —
o cliente entra, vê o projeto, aprova conteúdo. Só param as notificações e o
espelhamento operacional.

Toda integração é acessada por uma abstração nomeada. Chamada direta a SDK
externo espalhada pelo código é proibida.

## E-mail

Dois caminhos distintos, um único provedor. Ver
[ADR-0010](adr/0010-email-auth-vs-produto.md).

| Caminho          | Quem envia                                                      | O quê                                                                                    |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Autenticação** | Supabase Auth, via **SMTP customizado apontando para o Resend** | magic link, convite                                                                      |
| **Produto**      | `EmailService` → **API do Resend**                              | estratégia pronta, conteúdo aguardando aprovação, alteração solicitada, review publicado |

Por que assim: o Supabase precisa enviar o link de autenticação e não aceita que
a aplicação intercepte esse envio sem reimplementar o fluxo. Configurar o SMTP
customizado resolve com zero código, mantém o remetente e o visual da Boop, e
evita o domínio genérico do Supabase caindo em spam.

### `EmailService`

```ts
// src/lib/integrations/email/service.ts
export interface EmailService {
  send<T extends EmailTemplate>(template: T, input: EmailInput<T>): Promise<EmailResult>
}
```

Regras:

- **Nenhum arquivo fora de `lib/integrations/email` importa o SDK do Resend.**
- Todo envio grava uma linha em `notifications` **antes** de tentar: `pending` →
  `sent` ou `failed` com `error`. Nada é enviado sem rastro.
- `dedupe_key` impede duplicata: `content.awaiting_client:{versionId}`.
- Falha de envio **nunca** derruba o workflow. O admin lista falhas e reenvia.
- `EMAIL_DRY_RUN=true` em desenvolvimento imprime no log em vez de enviar.
- Nenhum e-mail carrega dado sensível: leva contexto mínimo e um link para o
  Boop OS. Legenda, resposta de onboarding e nota interna ficam no sistema.

### Templates

| Template                 | Gatilho                                            | Destinatário | Fase |
| ------------------------ | -------------------------------------------------- | ------------ | ---- |
| `invite`                 | `inviteUser`                                       | cliente      | 5    |
| `welcome`                | primeiro login                                     | cliente      | 5    |
| `onboarding_completed`   | `submitOnboarding`                                 | equipe Boop  | 7    |
| `strategy_ready`         | `sendStrategyForApproval`                          | cliente      | 9    |
| `content_needs_approval` | `submitContentForApproval`                         | cliente      | 11   |
| `changes_requested`      | `requestContentChanges` / `requestStrategyChanges` | equipe Boop  | 11   |
| `review_ready`           | `publishMonthlyReview`                             | cliente      | 15   |

Templates em React Email ou HTML simples, com fallback em texto puro. Assunto e
corpo em pt-BR, tom da marca, sem emoji decorativo.

**Agrupamento:** conteúdo enviado em lote não gera um e-mail por item. Aviso por
lote, com contagem. Detalhe em `docs/roadmap.md`, FASE 16.

## Notion — FASE 17

**Projeção operacional interna, unidirecional: Boop OS → Notion.** Nunca o
contrário. Ver [ADR-0002](adr/0002-supabase-fonte-unica-da-verdade.md).

O Notion não é banco. Se um sync falhar, o dado no Supabase continua correto e a
aplicação não muda de comportamento.

Projeções previstas:

- cliente criado → página no Notion;
- onboarding concluído → registro no workspace com link para as respostas;
- alteração solicitada pelo cliente → item operacional na base de produção.

Implementação:

- `NotionAdapter` isolado em `src/lib/integrations/notion`;
- tabela `integration_events` (criada nesta fase, não antes) com `provider`,
  `event`, `entity`, `status`, `attempts`, `error`, `external_id`;
- mapeamento entidade → página em `external_id`, permitindo atualização;
- falha registra `integration.failed` e **não** derruba a operação de domínio;
- sem sync bidirecional na V0. Conflito de escrita entre dois sistemas é o
  problema mais caro de sistemas pequenos.
- a aplicação precisa subir e funcionar com `NOTION_API_KEY` ausente.

## Calendário — fora da V0

Reuniões vivem em `meetings`, com `meeting_url` preenchida manualmente e timezone
padrão `America/Sao_Paulo`.

Quando entrar Google Calendar, entra como `CalendarAdapter` (`createEvent`,
`updateEvent`, `cancelEvent`) e `meetings` ganha `external_calendar_id`. O schema
já suporta; nada precisa ser reescrito.

## Métricas — manual na V0

`account_metrics` e `content_metrics` já têm a coluna `source`, hoje sempre
`manual`. Quando a Meta API entrar, vira `meta` e os dados convivem sem migration
de esquema. Nenhum componente de Resultados assume origem.

## Como uma integração nova entra

1. ADR justificando: qual problema, por que agora, o que acontece se cair.
2. Adapter isolado em `src/lib/integrations/<nome>`, com interface própria — o
   domínio depende da interface, nunca do SDK.
3. Nenhuma escrita de domínio dependendo do serviço externo.
4. Falha registrada (`integration_events` + activity log), nunca silenciosa,
   nunca fatal.
5. Segredo apenas server-side, documentado em `.env.example`.
6. A aplicação sobe com a variável ausente.

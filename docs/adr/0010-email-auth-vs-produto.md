# ADR-0010 — E-mail de autenticação pelo Supabase (SMTP Resend), e-mail de produto pela API do Resend

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

A §24 manda usar Resend com um `EmailService` centralizado. Mas o e-mail mais
importante do sistema — o magic link — é enviado pelo Supabase Auth, que não
entrega esse disparo para a aplicação sem reimplementar o fluxo. Além disso, o
Marco 1 (§45) precisa de e-mail já na FASE 5, e não na FASE 16
([spec-review I-06](../spec-review.md#i-06-a-o-primeiro-marco-exige-e-mail-que-só-aparece-na-fase-16)).

## Decisão

Dois caminhos, um provedor:

- **Autenticação:** Supabase Auth com **SMTP customizado apontando para o
  Resend**. Templates editados no Supabase, remetente e domínio da Boop.
- **Produto:** `EmailService` chamando a **API do Resend**, com todo envio
  registrado em `notifications`.

O `EmailService` mínimo (`invite`, `welcome`) entra na FASE 5; o catálogo completo
permanece na FASE 16.

## Alternativas consideradas

| Alternativa                                    | Por que não                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `generateLink` no servidor + envio pelo Resend | Controle total, mas reimplementa o fluxo de auth e assume o risco de errar em expiração e uso único |
| SMTP padrão do Supabase                        | Remetente genérico, baixa entregabilidade, sem identidade da Boop                                   |
| Dois provedores                                | Dois domínios para autenticar, dois lugares para depurar entrega                                    |

## Consequências

- Um único domínio verificado (SPF, DKIM, DMARC) serve aos dois caminhos.
- O e-mail de autenticação não passa por `notifications`: seu registro é o log do
  Supabase. Assimetria conhecida e aceita.
- O template de auth vive no painel do Supabase, fora do repositório. Fica
  documentado em `docs/deployment.md` e precisa ser conferido antes de produção.
- Nenhum e-mail carrega dado sensível: contexto mínimo e link para o sistema.

## Gatilho de revisão

Necessidade de template de auth versionado no repositório, ou de personalização
que o painel do Supabase não permita.

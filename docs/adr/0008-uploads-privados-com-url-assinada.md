# ADR-0008 — Uploads em bucket privado com URL assinada em dois passos

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §22 exige bucket privado, metadata no banco e autorização que não dependa do
path. A Vercel limita o corpo de requisição (~4,5 MB em Server Actions), e vídeo
de conteúdo passa disso com folga.

## Decisão
Bucket privado, **zero policy** para `anon`/`authenticated` em `storage.objects`.
Upload em dois passos: `requestUpload()` autoriza e devolve uma signed upload URL;
o browser envia direto ao Storage; `confirmUpload()` revalida MIME e tamanho reais
no servidor e marca `ready`. Download por Route Handler que autoriza pela tabela
`files` e assina uma URL de TTL curto (60 s preview, 300 s download).

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Upload passando pelo servidor | Estoura o limite de corpo; consome tempo de função |
| Policies de storage por path | O path viraria autorização — exatamente o que a §22 proíbe |
| Bucket público com path secreto | Segurança por obscuridade; um link vazado é permanente |
| Proxy de download pelo servidor | Custo de banda e tempo de função para nenhum ganho sobre TTL curto |

## Consequências
- Metadata e autorização no banco; o path é só endereço.
- Objeto órfão é possível (upload confirmado nunca chega): rotina de limpeza de
  `pending` antigos a partir da FASE 12.
- O cliente pode mentir sobre MIME e tamanho no passo 1 — por isso a revalidação
  no passo 3 é obrigatória, não opcional.
- SVG bloqueado; download não-imagem forçado como `attachment`.
- URL assinada é bearer token: TTL curto, nunca logada, nunca em HTML cacheável.

## Gatilho de revisão
Necessidade de transformação de imagem no servidor ou de CDN pública para
material de marketing.

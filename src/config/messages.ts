/**
 * Códigos de erro de domínio traduzidos para pt-BR.
 *
 * A separação vem da regra do frontend: o workflow devolve `code`, e a tela
 * traduz. O motivo é que a mesma falha aparece em lugares com voz diferente, e
 * uma frase montada no servidor não sabe onde vai ser lida.
 *
 * ## Como se escreve uma mensagem aqui
 *
 * Sem jargão, sem nome de tabela, sem status técnico. "Já existe um cliente com
 * esse identificador" — nunca "unique violation on clients_slug_key". Quem lê é
 * quem administra a Boop, não quem escreveu o schema (.claude/rules/frontend.md).
 *
 * ## O fallback
 *
 * `messageFor()` devolve uma frase genérica para código desconhecido. É de
 * propósito: um código novo que ninguém traduziu aparece como "não foi possível
 * concluir", e não como string crua na tela — que é o vazamento mais bobo e
 * mais comum de vocabulário interno.
 */
export const WORKFLOW_MESSAGE: Record<string, string> = {
  /* ── Genéricos ─────────────────────────────────────────────────────────── */
  'actor.unauthenticated': 'Sua sessão expirou. Entre de novo para continuar.',
  'actor.inactive': 'Seu acesso não está ativo.',
  'input.invalid': 'Revise os campos destacados.',
  'resource.not_found': 'Não encontramos esse registro.',
  'workflow.unexpected': 'Não foi possível concluir. Tente de novo em instantes.',

  /* ── Clientes ──────────────────────────────────────────────────────────── */
  'client.slug_taken': 'Já existe um cliente com esse identificador.',
  'client.create_failed': 'Não foi possível criar o cliente.',
  'client.update_failed': 'Não foi possível salvar as alterações.',
  'client.archived_needs_admin':
    'Este cliente está arquivado. Só um admin da Boop pode trazê-lo de volta.',
  'client.create.denied': 'Só um admin da Boop cria clientes.',
  'client.update.denied': 'Você não tem permissão para editar este cliente.',
  'client.archive.denied': 'Só um admin da Boop arquiva clientes.',

  /* ── Projetos ──────────────────────────────────────────────────────────── */
  'project.create_failed': 'Não foi possível criar o projeto.',
  'project.update_failed': 'Não foi possível salvar as alterações.',
  'project.advance_failed': 'Não foi possível avançar a etapa.',
  'project.stage_update_failed': 'Não foi possível corrigir a jornada.',
  'project.immutable_field':
    'O tipo e a jornada de um projeto são definidos na criação e não mudam. Crie um projeto novo e arquive este.',
  'project.no_current_stage':
    'Este projeto não tem etapa em andamento. Escolha por onde retomar antes de avançar.',
  'project.archived_is_final':
    'Este projeto está arquivado. Reabrir não é possível pelo painel — crie um projeto novo.',
  'project.create.denied': 'Só um admin da Boop cria projetos.',
  'project.update.denied': 'Você não tem permissão para editar este projeto.',
  'project.advance_stage.denied': 'Você não tem permissão para mover a jornada deste projeto.',
  'project.change_status.denied': 'Você não tem permissão para mudar o status deste projeto.',

  /* ── Pessoas ───────────────────────────────────────────────────────────── */
  'user.invite.denied': 'Só um admin da Boop convida pessoas.',
  'user.disable.denied': 'Só um admin da Boop desliga pessoas.',
  'user.disable_denied': 'Não é possível desligar essa pessoa.',
  'user.disable_failed': 'Não foi possível desligar essa pessoa.',
  'invite.not_configured':
    'O envio de convites ainda não está configurado neste ambiente. Fale com quem cuida da infraestrutura.',
  'invite.failed': 'Não foi possível enviar o convite. Tente de novo em instantes.',
  'invite.role_failed': 'A conta foi criada, mas o papel não pôde ser definido.',
  'invite.user_disabled': 'Essa pessoa foi desligada. Reativar acesso não é possível pelo painel.',
  'invite.account_exists_without_profile':
    'Já existe uma conta com esse e-mail, mas sem perfil. Fale com quem cuida da infraestrutura.',

  /* ── Vínculos ──────────────────────────────────────────────────────────── */
  'membership.grant.denied': 'Só um admin da Boop dá acesso a um cliente.',
  'membership.revoke.denied': 'Só um admin da Boop remove acesso.',
  'membership.grant_failed': 'Não foi possível dar acesso.',
  'membership.revoke_failed': 'Não foi possível remover o acesso.',
  'membership.user_disabled': 'Essa pessoa está desligada.',
  'membership.admin_is_global': 'Admins da Boop já alcançam todos os clientes.',

  /* Onboarding — FASE 7 */
  'onboarding.start_failed': 'Não foi possível abrir o onboarding.',
  'onboarding.unsupported': 'Esse tipo de projeto ainda não tem formulário de onboarding.',
  'onboarding.stage_not_current':
    'Avance o projeto para a etapa Onboarding antes de abrir o formulário.',
  'onboarding.not_started': 'O onboarding deste projeto ainda não foi aberto.',
  'onboarding.already_submitted': 'Este onboarding já foi enviado.',
  'onboarding.question_not_found': 'Essa pergunta não faz parte deste onboarding.',
  'onboarding.answer_invalid': 'Essa resposta não é válida para esta pergunta.',
  'onboarding.save_failed': 'Não foi possível salvar sua resposta. Tente de novo.',
  'onboarding.submit_failed': 'Não foi possível enviar o onboarding.',
  'onboarding.required_missing': 'Ainda faltam respostas obrigatórias.',
  'onboarding.reopen_failed': 'Não foi possível reabrir o onboarding.',
  'onboarding.start.denied': 'Você não tem permissão para abrir o onboarding deste projeto.',
  'onboarding.answer.denied': 'Você não tem permissão para responder este onboarding.',
  'onboarding.submit.denied': 'Você não tem permissão para enviar este onboarding.',
  'onboarding.reopen.denied': 'Só um admin da Boop reabre um onboarding.',
}

const FALLBACK = 'Não foi possível concluir. Tente de novo em instantes.'

export function messageFor(code: string | undefined | null): string {
  if (!code) return FALLBACK
  return WORKFLOW_MESSAGE[code] ?? FALLBACK
}

/**
 * Mensagens de validação por campo, vindas do zod.
 *
 * Os códigos são os `error:` dos schemas — `slug_invalid`, `email_invalid`. O
 * schema fala em código porque ele roda no servidor e no cliente, e a mesma
 * regra não deveria carregar duas frases.
 */
export const FIELD_MESSAGE: Record<string, string> = {
  name_too_short: 'Use pelo menos 2 caracteres.',
  name_too_long: 'Use no máximo 120 caracteres.',
  slug_too_short: 'Use pelo menos 2 caracteres.',
  slug_too_long: 'Use no máximo 60 caracteres.',
  slug_invalid: 'Use apenas letras minúsculas, números e hífen. Ex.: hartmann-advogados',
  notes_too_long: 'Use no máximo 4000 caracteres.',
  email_invalid: 'Informe um e-mail válido.',
  email_too_long: 'E-mail longo demais.',
  client_id_invalid: 'Cliente inválido.',
  user_id_invalid: 'Pessoa inválida.',
  client_required_for_client_user: 'Escolha o cliente que essa pessoa vai acessar.',
  project_id_invalid: 'Projeto inválido.',
  question_id_invalid: 'Pergunta inválida.',
  answer_value_invalid: 'Valor inválido para esta pergunta.',
  answer_too_long: 'Resposta longa demais.',
}

/** A primeira mensagem de um campo, já traduzida. */
export function fieldMessage(
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined {
  const code = fieldErrors?.[field]?.[0]
  if (!code) return undefined
  return FIELD_MESSAGE[code] ?? 'Valor inválido.'
}

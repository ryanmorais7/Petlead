import type {
  FollowupStatus,
  LeadEventType,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  SuggestionType,
} from "./enums";

/** Visual tone shared by badges and indicators. */
export type Tone = "neutral" | "brand" | "accent" | "info" | "warning" | "danger" | "success";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  INTERESTED: "Interessado",
  HOT: "Quente",
  THINKING: "Pensando",
  WAITING_FAMILY: "Consultando a família",
  COMPARING_COMPETITOR: "Comparando planos",
  WAITING_DOCUMENTS: "Aguardando documentos",
  WAITING_PAYMENT: "Aguardando pagamento",
  NO_RESPONSE: "Sem resposta",
  FOLLOW_UP: "Em follow-up",
  READY_TO_CLOSE: "Pronto para fechar",
  CLOSED: "Fechado",
  LOST: "Perdido",
  DO_NOT_CONTACT: "Não contatar",
};

export const LEAD_STATUS_TONES: Record<LeadStatus, Tone> = {
  NEW: "info",
  CONTACTED: "neutral",
  INTERESTED: "brand",
  HOT: "accent",
  THINKING: "warning",
  WAITING_FAMILY: "warning",
  COMPARING_COMPETITOR: "warning",
  WAITING_DOCUMENTS: "info",
  WAITING_PAYMENT: "info",
  NO_RESPONSE: "neutral",
  FOLLOW_UP: "neutral",
  READY_TO_CLOSE: "accent",
  CLOSED: "success",
  LOST: "neutral",
  DO_NOT_CONTACT: "danger",
};

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  HOT: "Quente",
  WARM: "Morno",
  COLD: "Frio",
};

export const TEMPERATURE_TONES: Record<LeadTemperature, Tone> = {
  HOT: "accent",
  WARM: "warning",
  COLD: "info",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  INDICACAO: "Indicação",
  PANFLETO: "Panfleto",
  INFLUENCIADOR: "Influenciador",
  CONDOMINIO: "Condomínio",
  OUTRO: "Outro",
};

export const FOLLOWUP_STATUS_LABELS: Record<FollowupStatus, string> = {
  PENDING: "Agendado",
  READY: "Pronto para revisar",
  APPROVED: "Aprovado",
  SENT: "Enviado",
  CANCELLED: "Cancelado",
  SKIPPED: "Pulado",
};

export const FOLLOWUP_STATUS_TONES: Record<FollowupStatus, Tone> = {
  PENDING: "neutral",
  READY: "accent",
  APPROVED: "brand",
  SENT: "success",
  CANCELLED: "neutral",
  SKIPPED: "neutral",
};

export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  REPLY: "Resposta",
  FOLLOW_UP: "Follow-up",
  REACTIVATION: "Reativação",
  CLOSING: "Fechamento",
};

export const LEAD_EVENT_LABELS: Record<LeadEventType, string> = {
  LEAD_CREATED: "Lead criado",
  MESSAGE_RECEIVED: "Mensagem recebida",
  MESSAGE_SENT: "Mensagem enviada",
  STATUS_CHANGED: "Status alterado",
  FOLLOWUP_CREATED: "Follow-up agendado",
  FOLLOWUP_SENT: "Follow-up enviado",
  SALE_CLOSED: "Venda fechada",
  DO_NOT_CONTACT_SET: "Marcado como não contatar",
};

import { ZodError } from "zod";

export const ERROR_CODES = [
  "VALIDATION",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "CONTACT_BLOCKED",
  "INTEGRATION",
  "UNEXPECTED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const USER_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Alguns dados não estão corretos. Revise e tente novamente.",
  NOT_FOUND: "Não encontramos o que você procura.",
  UNAUTHORIZED: "Você precisa entrar na sua conta para continuar.",
  CONTACT_BLOCKED: "Este cliente pediu para não ser contatado.",
  INTEGRATION: "Um serviço externo não respondeu. Tente novamente em instantes.",
  UNEXPECTED: "Algo deu errado por aqui. Tente novamente em instantes.",
};

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  CONTACT_BLOCKED: 409,
  INTEGRATION: 502,
  UNEXPECTED: 500,
};

/**
 * Error with a stable code. `message` is technical and goes to the logs;
 * the text shown to the seller always comes from `toUserMessage`.
 */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, options?: ErrorOptions) {
    super(message ?? code, options);
    this.name = "AppError";
    this.code = code;
  }
}

export function toErrorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  if (error instanceof ZodError) return "VALIDATION";
  return "UNEXPECTED";
}

/** Friendly message in Portuguese. Never exposes technical details. */
export function toUserMessage(error: unknown): string {
  return USER_MESSAGES[toErrorCode(error)];
}

export function toHttpStatus(error: unknown): number {
  return HTTP_STATUS[toErrorCode(error)];
}

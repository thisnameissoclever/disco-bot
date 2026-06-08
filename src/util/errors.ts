export class DiscoError extends Error {
  public readonly code: string;
  public readonly userMessage: string;

  constructor(code: string, userMessage: string, options?: { cause?: unknown; message?: string }) {
    super(options?.message ?? userMessage, options?.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.userMessage = userMessage;
    this.name = 'DiscoError';
  }
}

export class ConfigValidationError extends DiscoError {
  constructor(key: string, reason: string) {
    super('config_validation', `Invalid value for \`${key}\`: ${reason}`);
    this.name = 'ConfigValidationError';
  }
}

export class ProviderNotConfiguredError extends DiscoError {
  constructor(providerId: string) {
    super(
      'provider_not_configured',
      `Provider \`${providerId}\` is not configured in this deployment.`,
    );
    this.name = 'ProviderNotConfiguredError';
  }
}

export class RetrievalUnavailableError extends DiscoError {
  constructor(mode: string, reason: string) {
    super('retrieval_unavailable', `Retrieval mode \`${mode}\` is not available: ${reason}`);
    this.name = 'RetrievalUnavailableError';
  }
}

export class AssistantAccessDeniedError extends DiscoError {
  constructor(reason: string) {
    super('assistant_access_denied', reason);
    this.name = 'AssistantAccessDeniedError';
  }
}

export class PointAwardRejectedError extends DiscoError {
  constructor(public readonly reason: PointRejectReason, message: string) {
    super('point_award_rejected', message);
    this.name = 'PointAwardRejectedError';
  }
}

export type PointRejectReason =
  | 'self_award'
  | 'bot_recipient'
  | 'duplicate'
  | 'excluded_channel'
  | 'excluded_role'
  | 'missing_required_role'
  | 'budget_exhausted'
  | 'emoji_mismatch'
  | 'unknown';

export function isDiscoError(value: unknown): value is DiscoError {
  return value instanceof DiscoError;
}

import type { ApiErrorCode, Ctx } from './types';

export const sendError = (
  ctx: Ctx,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): void => {
  ctx.status = status;
  ctx.body = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
};

export const getPostgresErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const maybeCode = (error as { code?: string }).code;
  return typeof maybeCode === 'string' ? maybeCode : undefined;
};

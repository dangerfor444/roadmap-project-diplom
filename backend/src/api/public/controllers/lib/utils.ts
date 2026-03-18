import type { Ctx } from './types';

export const toPositiveInt = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const toPositiveIntFromUnknown = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const asString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const getHeaderValue = (ctx: Ctx, headerName: string): string => {
  const value = ctx.request.headers?.[headerName];
  if (Array.isArray(value)) return asString(value[0]);
  return asString(value);
};

export const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

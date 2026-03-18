const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const resolveAllowedEmails = (): Set<string> => {
  const raw = String(import.meta.env.VITE_MANAGER_ALLOWED_EMAILS ?? '').trim();
  const values = raw
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return new Set(values);
};

const ALLOWED_MANAGER_EMAILS = resolveAllowedEmails();

export const isManagerEmailAllowed = (email: string): boolean =>
  ALLOWED_MANAGER_EMAILS.has(normalizeEmail(email));

const FINGERPRINT_KEY = 'roadmap:user-fingerprint';

const makeFingerprint = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fp_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  const randomPart = Math.random().toString(36).slice(2);
  const timePart = Date.now().toString(36);
  return `fp_${timePart}_${randomPart}`;
};

export const getUserFingerprint = (): string => {
  const existing = localStorage.getItem(FINGERPRINT_KEY);
  if (existing) {
    return existing;
  }

  const next = makeFingerprint();
  localStorage.setItem(FINGERPRINT_KEY, next);
  return next;
};

export type PublicWriteAuthMode = 'demo' | 'hybrid' | 'auth';

const ACTOR_ID_STORAGE_KEY = 'public:actor-id';
const ACTOR_TOKEN_STORAGE_KEY = 'public:actor-token';
export const PUBLIC_WRITE_AUTH_UPDATED_EVENT = 'public-write-auth-updated';
export const EMBED_AUTH_MESSAGE_TYPE = 'roadmap-widget-auth';
export const EMBED_READY_MESSAGE_TYPE = 'roadmap-widget-ready';

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`;
  return atob(padded);
};

const parseActorIdFromToken = (token: string): string => {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[0]) {
    return '';
  }

  try {
    const payloadJson = decodeBase64Url(parts[0]);
    const payload = JSON.parse(payloadJson) as { actorId?: unknown };
    return typeof payload.actorId === 'string' ? payload.actorId.trim() : '';
  } catch {
    return '';
  }
};

const hashIdentity = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const emitAuthUpdated = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUBLIC_WRITE_AUTH_UPDATED_EVENT));
};

const normalizeMode = (value: string): PublicWriteAuthMode => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'auth' || normalized === 'hybrid' || normalized === 'demo') {
    return normalized;
  }
  return 'auth';
};

const PUBLIC_WRITE_AUTH_MODE: PublicWriteAuthMode = normalizeMode(
  import.meta.env.VITE_PUBLIC_WRITE_AUTH_MODE ?? 'auth'
);

export const getPublicWriteAuthMode = (): PublicWriteAuthMode => PUBLIC_WRITE_AUTH_MODE;

export const getStoredActorId = (): string => {
  const value = localStorage.getItem(ACTOR_ID_STORAGE_KEY) ?? '';
  return value.trim();
};

export const setStoredActorId = (value: string): string => {
  const normalized = value.trim();
  if (normalized) {
    localStorage.setItem(ACTOR_ID_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(ACTOR_ID_STORAGE_KEY);
  }
  emitAuthUpdated();
  return normalized;
};

export const getStoredActorToken = (): string => {
  const value = localStorage.getItem(ACTOR_TOKEN_STORAGE_KEY) ?? '';
  return value.trim();
};

export const setStoredActorToken = (value: string): string => {
  const normalized = value.trim();
  if (normalized) {
    localStorage.setItem(ACTOR_TOKEN_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(ACTOR_TOKEN_STORAGE_KEY);
  }
  emitAuthUpdated();
  return normalized;
};

export type EmbedAuthPayload = {
  actorId?: string;
  actorToken?: string;
};

export const applyEmbeddedAuth = (payload: EmbedAuthPayload): void => {
  const actorId = (payload.actorId ?? '').trim();
  const actorToken = (payload.actorToken ?? '').trim();

  setStoredActorId(actorId);
  setStoredActorToken(actorToken);
};

export type WriteIdentity = {
  headers: Record<string, string>;
  userFingerprint?: string;
};

export const resolveWriteIdentity = (userFingerprint: string): WriteIdentity => {
  const actorId = getStoredActorId();
  const actorToken = getStoredActorToken();
  const headers: Record<string, string> = {};
  const actorIdFromToken = actorToken ? parseActorIdFromToken(actorToken) : '';
  const effectiveActorId = actorId || actorIdFromToken;

  if (actorToken) {
    headers['x-actor-token'] = actorToken;
  }
  if (effectiveActorId) {
    headers['x-actor-id'] = effectiveActorId;
  }

  const hasActorHeaders = Object.keys(headers).length > 0;

  if (PUBLIC_WRITE_AUTH_MODE === 'auth') {
    if (hasActorHeaders) return { headers };
    return { headers: {} };
  }

  if (PUBLIC_WRITE_AUTH_MODE === 'hybrid' && hasActorHeaders) {
    return { headers };
  }

  return {
    headers: {},
    userFingerprint,
  };
};

export const getWriteStorageIdentity = (userFingerprint: string): string => {
  const actorId = getStoredActorId();
  if (actorId) {
    return `actor:${actorId}`;
  }

  const actorToken = getStoredActorToken();
  if (actorToken) {
    const actorIdFromToken = parseActorIdFromToken(actorToken);
    if (actorIdFromToken) {
      return `actor:${actorIdFromToken}`;
    }
    return `token:${hashIdentity(actorToken)}`;
  }

  const normalizedFingerprint = userFingerprint.trim();
  return `fingerprint:${normalizedFingerprint}`;
};

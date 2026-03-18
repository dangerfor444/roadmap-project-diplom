const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:1337').replace(
  /\/+$/,
  ''
);

const WIDGET_AUTH_JWT_STORAGE_KEY = 'widget-auth:jwt';
const WIDGET_AUTH_USER_STORAGE_KEY = 'widget-auth:user';

type RawWidgetUser = {
  id?: unknown;
  username?: unknown;
  email?: unknown;
};

export type WidgetAuthUser = {
  id: number;
  username: string;
  email: string;
};

export type WidgetAuthSession = {
  jwt: string;
  user: WidgetAuthUser;
};

export type RegisterWidgetUserResult = {
  session: WidgetAuthSession | null;
  user: WidgetAuthUser;
  requiresEmailConfirmation: boolean;
};

type AuthResponsePayload = {
  jwt?: unknown;
  user?: RawWidgetUser;
};

type ActorTokenPayload = {
  data?: {
    actorId?: unknown;
    actorToken?: unknown;
    exp?: unknown;
    user?: RawWidgetUser;
  };
};

export type ActorTokenResult = {
  actorId: string;
  actorToken: string;
  exp: number;
  user: WidgetAuthUser;
};

export class WidgetAuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WidgetAuthApiError';
    this.status = status;
  }
}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asWidgetUser = (value: RawWidgetUser | undefined): WidgetAuthUser => {
  const id = Number(value?.id);
  const username = asString(value?.username);
  const email = asString(value?.email);

  if (!Number.isInteger(id) || id <= 0) {
    throw new WidgetAuthApiError(
      'Некорректный ответ авторизации: отсутствует id пользователя.',
      500
    );
  }

  return {
    id,
    username: username || `user_${id}`,
    email: email || '',
  };
};

const asErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;

  const payloadObj = payload as Record<string, unknown>;
  if (typeof payloadObj.error === 'string') return payloadObj.error;
  if (payloadObj.error && typeof payloadObj.error === 'object') {
    const nested = payloadObj.error as Record<string, unknown>;
    if (typeof nested.message === 'string') return nested.message;
  }
  if (typeof payloadObj.message === 'string') return payloadObj.message;
  return null;
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      asErrorMessage(payload) ??
      `Ошибка запроса: HTTP ${response.status}`;
    throw new WidgetAuthApiError(message, response.status);
  }

  return payload as T;
};

export const registerWidgetUser = async (input: {
  email: string;
  password: string;
  username: string;
}): Promise<RegisterWidgetUserResult> => {
  const payload = await requestJson<AuthResponsePayload>('/api/auth/local/register', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      username: input.username,
    }),
  });

  const jwt = asString(payload.jwt);
  const user = asWidgetUser(payload.user);

  return {
    session: jwt ? { jwt, user } : null,
    user,
    requiresEmailConfirmation: !jwt,
  };
};

export const sendWidgetEmailConfirmation = async (email: string): Promise<void> => {
  await requestJson<Record<string, unknown>>('/api/auth/send-email-confirmation', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const requestWidgetPasswordReset = async (email: string): Promise<void> => {
  await requestJson<Record<string, unknown>>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const resetWidgetPassword = async (input: {
  code: string;
  password: string;
  passwordConfirmation: string;
}): Promise<WidgetAuthSession> => {
  const payload = await requestJson<AuthResponsePayload>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      code: input.code,
      password: input.password,
      passwordConfirmation: input.passwordConfirmation,
    }),
  });

  const jwt = asString(payload.jwt);
  if (!jwt) {
    throw new WidgetAuthApiError(
      'Некорректный ответ сброса пароля: отсутствует JWT.',
      500
    );
  }

  return {
    jwt,
    user: asWidgetUser(payload.user),
  };
};

export const loginWidgetUser = async (input: {
  identifier: string;
  password: string;
}): Promise<WidgetAuthSession> => {
  const payload = await requestJson<AuthResponsePayload>('/api/auth/local', {
    method: 'POST',
    body: JSON.stringify({
      identifier: input.identifier,
      password: input.password,
    }),
  });

  const jwt = asString(payload.jwt);
  if (!jwt) {
    throw new WidgetAuthApiError(
      'Некорректный ответ авторизации: отсутствует JWT.',
      500
    );
  }

  return {
    jwt,
    user: asWidgetUser(payload.user),
  };
};

export const issueActorTokenForJwt = async (jwt: string): Promise<ActorTokenResult> => {
  const payload = await requestJson<ActorTokenPayload>('/api/public/auth/actor-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: '{}',
  });

  const actorId = asString(payload.data?.actorId);
  const actorToken = asString(payload.data?.actorToken);
  const exp = Number(payload.data?.exp);
  const user = asWidgetUser(payload.data?.user);

  if (!actorId || !actorToken || !Number.isFinite(exp)) {
    throw new WidgetAuthApiError(
      'Некорректный ответ при выпуске токена пользователя.',
      500
    );
  }

  return {
    actorId,
    actorToken,
    exp,
    user,
  };
};

export const saveWidgetAuthSession = (session: WidgetAuthSession): void => {
  localStorage.setItem(WIDGET_AUTH_JWT_STORAGE_KEY, session.jwt);
  localStorage.setItem(WIDGET_AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
};

export const clearWidgetAuthSession = (): void => {
  localStorage.removeItem(WIDGET_AUTH_JWT_STORAGE_KEY);
  localStorage.removeItem(WIDGET_AUTH_USER_STORAGE_KEY);
};

export const getWidgetAuthSession = (): WidgetAuthSession | null => {
  const jwt = asString(localStorage.getItem(WIDGET_AUTH_JWT_STORAGE_KEY));
  const rawUser = localStorage.getItem(WIDGET_AUTH_USER_STORAGE_KEY);

  if (!jwt || !rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as RawWidgetUser;
    return {
      jwt,
      user: asWidgetUser(parsed),
    };
  } catch {
    clearWidgetAuthSession();
    return null;
  }
};
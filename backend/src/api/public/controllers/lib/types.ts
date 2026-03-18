export type Ctx = {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  request: {
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  };
  status: number;
  body: unknown;
};

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED';

export type WriteAuthMode = 'demo' | 'hybrid' | 'auth';

export type ActorContext = {
  mode: WriteAuthMode;
  actorId: string | null;
  userFingerprint: string | null;
  storageFingerprint: string;
};

export type ActorContextResult =
  | { ok: true; actor: ActorContext }
  | { ok: false; message: string };

export type ActorTokenVerifyResult =
  | {
      ok: true;
      actorId: string;
    }
  | {
      ok: false;
      message: string;
    };

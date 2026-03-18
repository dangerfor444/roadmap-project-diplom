import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import {
  applyEmbeddedAuth,
  EMBED_AUTH_MESSAGE_TYPE,
  EMBED_READY_MESSAGE_TYPE,
} from './lib/write-auth';

const resolveBasename = (): string => {
  const pathname = window.location.pathname;
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    return '/app';
  }
  return '/';
};

const resolveExpectedParentOrigin = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const value = (params.get('parentOrigin') ?? '').trim();
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const setupEmbedAuthBridge = (): void => {
  if (window.parent === window) return;

  const expectedParentOrigin = resolveExpectedParentOrigin();

  window.addEventListener('message', (event: MessageEvent) => {
    if (expectedParentOrigin && event.origin !== expectedParentOrigin) {
      return;
    }

    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    const payload = event.data as Record<string, unknown>;
    if (payload.type !== EMBED_AUTH_MESSAGE_TYPE) {
      return;
    }

    applyEmbeddedAuth({
      actorId: typeof payload.actorId === 'string' ? payload.actorId : '',
      actorToken: typeof payload.actorToken === 'string' ? payload.actorToken : '',
    });
  });

  const readyPayload = { type: EMBED_READY_MESSAGE_TYPE };
  if (expectedParentOrigin) {
    window.parent.postMessage(readyPayload, expectedParentOrigin);
  } else {
    window.parent.postMessage(readyPayload, '*');
  }
};

setupEmbedAuthBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={resolveBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>
);

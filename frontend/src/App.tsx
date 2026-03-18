import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './App.css';
import { AppRoutes } from './app/AppRoutes';
import { ExternalAuthPanel } from './features/auth/ExternalAuthPanel';
import { useActorIdentity } from './features/auth/useActorIdentity';
import { WidgetInternalAuthPanel } from './features/auth/WidgetInternalAuthPanel';
import { PUBLIC_WRITE_AUTH_REQUIRED_EVENT } from './lib/api';
import { getUserFingerprint } from './lib/fingerprint';
import { isManagerEmailAllowed } from './lib/manager-access';
import { getWidgetAuthSession } from './lib/widget-auth-api';
import {
  PUBLIC_WRITE_AUTH_UPDATED_EVENT,
  getPublicWriteAuthMode,
  type PublicWriteAuthMode,
} from './lib/write-auth';

const PUBLIC_WRITE_MODE: PublicWriteAuthMode = getPublicWriteAuthMode();
const WIDGET_INTERNAL_AUTH_ENABLED =
  String(import.meta.env.VITE_WIDGET_INTERNAL_AUTH_ENABLED ?? 'true').trim().toLowerCase() !==
  'false';

const WRITE_MODE_LABEL: Record<PublicWriteAuthMode, string> = {
  demo: 'демо',
  hybrid: 'гибрид',
  auth: 'авторизация',
};

const UI_TEXT = {
  title: 'Публичный roadmap и идеи',
  fingerprintPrefix:
    'Отпечаток пользователя (демо):',
  writeModePrefix: 'Режим записи:',
  authOpen: 'Вход',
  account: 'Аккаунт',
  authModalTitle: 'Вход и регистрация',
  authModalExternalTitle: 'Авторизация',
  close: 'Закрыть',
  ideas: 'Идеи',
  manager: 'Управление',
} as const;

function App() {
  const fingerprint = useMemo(() => getUserFingerprint(), []);
  const {
    actorId,
    actorToken,
    hasActorIdentity,
    onActorIdChange,
    onActorTokenChange,
    clearActorId,
    clearActorToken,
  } = useActorIdentity();

  const [currentEmail, setCurrentEmail] = useState<string>(
    () => getWidgetAuthSession()?.user.email ?? ''
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const syncManagerSession = () => {
      setCurrentEmail(getWidgetAuthSession()?.user.email ?? '');
    };
    const onAuthRequired = () => {
      setIsAuthModalOpen(true);
    };

    window.addEventListener(PUBLIC_WRITE_AUTH_UPDATED_EVENT, syncManagerSession as EventListener);
    window.addEventListener(PUBLIC_WRITE_AUTH_REQUIRED_EVENT, onAuthRequired as EventListener);
    return () => {
      window.removeEventListener(
        PUBLIC_WRITE_AUTH_UPDATED_EVENT,
        syncManagerSession as EventListener
      );
      window.removeEventListener(PUBLIC_WRITE_AUTH_REQUIRED_EVENT, onAuthRequired as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!WIDGET_INTERNAL_AUTH_ENABLED) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('resetCode') || params.get('code')) {
      setIsAuthModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAuthModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAuthModalOpen]);

  const isManagerAllowed = isManagerEmailAllowed(currentEmail);
  const shouldShowManualActorControls = !WIDGET_INTERNAL_AUTH_ENABLED && PUBLIC_WRITE_MODE !== 'demo';
  const hasAuthModal = WIDGET_INTERNAL_AUTH_ENABLED || shouldShowManualActorControls;
  const authButtonLabel = currentEmail ? UI_TEXT.account : UI_TEXT.authOpen;

  return (
    <main className="app">
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>{UI_TEXT.title}</h1>
            <p>
              {UI_TEXT.fingerprintPrefix} {fingerprint.slice(-12)}
            </p>
            <p>
              {UI_TEXT.writeModePrefix} {WRITE_MODE_LABEL[PUBLIC_WRITE_MODE]}
            </p>
          </div>

          {hasAuthModal ? (
            <div className="app-header-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsAuthModalOpen(true)}
              >
                {authButtonLabel}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <nav className="tabs">
        <NavLink to="/roadmap" className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}>
          roadmap
        </NavLink>
        <NavLink to="/ideas" className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}>
          {UI_TEXT.ideas}
        </NavLink>
        {isManagerAllowed ? (
          <NavLink
            to="/manager"
            className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
          >
            {UI_TEXT.manager}
          </NavLink>
        ) : null}
      </nav>

      <AppRoutes userFingerprint={fingerprint} isManagerAllowed={isManagerAllowed} />

      {hasAuthModal && isAuthModalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsAuthModalOpen(false)}
        >
          <div className="modal-card auth-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="auth-title">
                {WIDGET_INTERNAL_AUTH_ENABLED ? UI_TEXT.authModalTitle : UI_TEXT.authModalExternalTitle}
              </h3>
              <button
                type="button"
                className="inline-button"
                onClick={() => setIsAuthModalOpen(false)}
              >
                {UI_TEXT.close}
              </button>
            </div>

            {WIDGET_INTERNAL_AUTH_ENABLED ? (
              <WidgetInternalAuthPanel />
            ) : null}

            {shouldShowManualActorControls ? (
              <ExternalAuthPanel
                actorId={actorId}
                actorToken={actorToken}
                hasActorIdentity={hasActorIdentity}
                onActorIdChange={onActorIdChange}
                onActorTokenChange={onActorTokenChange}
                onClearActorId={clearActorId}
                onClearActorToken={clearActorToken}
                publicWriteMode={PUBLIC_WRITE_MODE}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;

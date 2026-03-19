import { useEffect, useState, type FormEvent } from 'react';
import {
  WidgetAuthApiError,
  clearWidgetAuthSession,
  getWidgetAuthSession,
  issueActorTokenForJwt,
  loginWidgetUser,
  registerWidgetUser,
  requestWidgetPasswordReset,
  resetWidgetPassword,
  saveWidgetAuthSession,
  sendWidgetEmailConfirmation,
  type WidgetAuthSession,
} from '../../lib/widget-auth-api';
import { setStoredActorId, setStoredActorToken } from '../../lib/write-auth';

const UI_TEXT = {
  title: 'Встроенная авторизация',
  accountTitle: 'Аккаунт',
  loginTab: 'Вход',
  registerTab: 'Регистрация',
  emailOrUsername: 'Почта или имя пользователя',
  email: 'Почта',
  username: 'Имя пользователя',
  password: 'Пароль',
  repeatPassword: 'Повторите пароль',
  login: 'Войти',
  loginLoading: 'Вход...',
  register: 'Зарегистрироваться',
  registerLoading: 'Регистрация...',
  forgotPassword: 'Забыли пароль?',
  emailForPasswordReset: 'Почта для сброса пароля',
  codeFromEmail: 'Код из письма',
  newPassword: 'Новый пароль',
  repeatNewPassword: 'Повторите новый пароль',
  sendEmail: 'Отправить письмо',
  sendEmailLoading: 'Отправка...',
  cancel: 'Отмена',
  resetPassword: 'Сбросить пароль',
  resetPasswordLoading: 'Сброс...',
  resendResetEmail: 'Отправить письмо ещё раз',
  logout: 'Выйти',
  pendingConfirmationPrefix: 'Ожидается подтверждение почты:',
  resendConfirmation: 'Отправить письмо повторно',
  resendConfirmationLoading: 'Отправка...',
  loggedInAsPrefix: 'Вы вошли как',
  emailLabel: 'Почта',
  registerDone: 'Регистрация почти завершена. Мы отправили письмо на',
  registerDoneSuffix: 'Подтвердите почту и затем войдите.',
  resendConfirmationDonePrefix: 'Письмо с подтверждением отправлено повторно на',
  resetEmailDonePrefix: 'Письмо для сброса пароля отправлено на',
  resetEmailDoneSuffix: 'Вставьте код из письма ниже.',
  resetCodePrefilledFromLink:
    'Код из письма подставлен автоматически. Введите новый пароль.',
  logoutDone: 'Вы вышли из аккаунта.',
  errLoginFields: 'Укажите почту или имя пользователя и пароль.',
  errLoginDefault: 'Не удалось выполнить вход.',
  errRegisterFields:
    'Для регистрации нужны почта, имя пользователя, пароль и подтверждение пароля.',
  errPasswordsMismatch: 'Пароли не совпадают.',
  errRegisterDefault: 'Не удалось зарегистрировать пользователя.',
  errResendEmailNoEmail:
    'Укажите email, чтобы отправить письмо подтверждения повторно.',
  errResendEmailDefault: 'Не удалось отправить письмо подтверждения.',
  errResetEmailNoEmail: 'Укажите email для восстановления пароля.',
  errResetEmailDefault: 'Не удалось отправить письмо для сброса пароля.',
  errResetFields: 'Для сброса пароля укажите код из письма и новый пароль.',
  errResetDefault: 'Не удалось сбросить пароль.',
} as const;

const asErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof WidgetAuthApiError && error.message.trim()) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isEmailConfirmationMessage = (message: string): boolean =>
  /confirm|подтверж|not confirmed/i.test(message.toLowerCase());

const getDisplayName = (session: WidgetAuthSession | null): string => {
  if (!session) {
    return '';
  }

  return session.user.username || session.user.email;
};

export const WidgetInternalAuthPanel = () => {
  const [widgetSession, setWidgetSession] = useState<WidgetAuthSession | null>(() =>
    getWidgetAuthSession()
  );
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordRepeat, setResetPasswordRepeat] = useState('');
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  const applyWidgetSession = async (session: WidgetAuthSession): Promise<void> => {
    const tokenData = await issueActorTokenForJwt(session.jwt);

    const normalizedSession = {
      jwt: session.jwt,
      user: tokenData.user,
    };

    setWidgetSession(normalizedSession);
    saveWidgetAuthSession(normalizedSession);
    setStoredActorId(tokenData.actorId);
    setStoredActorToken(tokenData.actorToken);
    setPendingConfirmationEmail('');
    setAuthInfo(null);
  };

  useEffect(() => {
    let cancelled = false;

    const restoreInternalAuth = async () => {
      const session = getWidgetAuthSession();
      if (!session) {
        setWidgetSession(null);
        return;
      }

      setAuthLoading(true);
      try {
        const tokenData = await issueActorTokenForJwt(session.jwt);
        if (cancelled) {
          return;
        }

        const normalizedSession = { jwt: session.jwt, user: tokenData.user };
        setWidgetSession(normalizedSession);
        saveWidgetAuthSession(normalizedSession);
        setStoredActorId(tokenData.actorId);
        setStoredActorToken(tokenData.actorToken);
        setAuthInfo(null);
      } catch {
        if (cancelled) {
          return;
        }

        clearWidgetAuthSession();
        setWidgetSession(null);
        setStoredActorId('');
        setStoredActorToken('');
        setAuthInfo(null);
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    void restoreInternalAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (getWidgetAuthSession()) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const resetCodeFromUrl = (params.get('resetCode') || params.get('code') || '').trim();
    if (!resetCodeFromUrl) {
      return;
    }

    setAuthMode('login');
    setShowPasswordReset(true);
    setPasswordResetStep('confirm');
    setResetCode(resetCodeFromUrl);
    setAuthError(null);
    setAuthInfo(UI_TEXT.resetCodePrefilledFromLink);

    params.delete('resetCode');
    params.delete('code');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, []);

  const onLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const identifier = loginIdentifier.trim();
    const password = loginPassword;

    if (!identifier || !password) {
      setAuthError(UI_TEXT.errLoginFields);
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);

    try {
      const session = await loginWidgetUser({ identifier, password });
      await applyWidgetSession(session);
      setLoginPassword('');
    } catch (error) {
      const message = asErrorMessage(error, UI_TEXT.errLoginDefault);
      setAuthError(message);

      if (identifier.includes('@') && isEmailConfirmationMessage(message)) {
        setPendingConfirmationEmail(identifier.toLowerCase());
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const onRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    const passwordRepeat = registerPasswordRepeat;
    const username = (registerUsername.trim() || email.split('@')[0] || '').slice(0, 64);

    if (!email || !password || !passwordRepeat || !username) {
      setAuthError(UI_TEXT.errRegisterFields);
      return;
    }

    if (password !== passwordRepeat) {
      setAuthError(UI_TEXT.errPasswordsMismatch);
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);

    try {
      const registerResult = await registerWidgetUser({
        email,
        username,
        password,
      });

      setRegisterPassword('');
      setRegisterPasswordRepeat('');

      if (registerResult.session) {
        await applyWidgetSession(registerResult.session);
        return;
      }

      setPendingConfirmationEmail(email);
      setAuthMode('login');
      setAuthInfo(`${UI_TEXT.registerDone} ${email}. ${UI_TEXT.registerDoneSuffix}`);
    } catch (error) {
      setAuthError(asErrorMessage(error, UI_TEXT.errRegisterDefault));
    } finally {
      setAuthLoading(false);
    }
  };

  const openPasswordReset = () => {
    const identifier = loginIdentifier.trim().toLowerCase();
    setShowPasswordReset(true);
    setPasswordResetStep('request');
    setResetCode('');
    setResetPasswordValue('');
    setResetPasswordRepeat('');
    setResetEmail(identifier.includes('@') ? identifier : '');
    setAuthError(null);
    setAuthInfo(null);
  };

  const onRequestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      setAuthError(UI_TEXT.errResetEmailNoEmail);
      return;
    }

    setPasswordResetLoading(true);
    setAuthError(null);
    setAuthInfo(null);

    try {
      await requestWidgetPasswordReset(email);
      setPasswordResetStep('confirm');
      setAuthInfo(`${UI_TEXT.resetEmailDonePrefix} ${email}. ${UI_TEXT.resetEmailDoneSuffix}`);
    } catch (error) {
      setAuthError(asErrorMessage(error, UI_TEXT.errResetEmailDefault));
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const onConfirmPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = resetCode.trim();
    const password = resetPasswordValue;
    const passwordRepeat = resetPasswordRepeat;

    if (!code || !password || !passwordRepeat) {
      setAuthError(UI_TEXT.errResetFields);
      return;
    }

    if (password !== passwordRepeat) {
      setAuthError(UI_TEXT.errPasswordsMismatch);
      return;
    }

    setPasswordResetLoading(true);
    setAuthError(null);
    setAuthInfo(null);

    try {
      const session = await resetWidgetPassword({
        code,
        password,
        passwordConfirmation: passwordRepeat,
      });
      await applyWidgetSession(session);
      setShowPasswordReset(false);
      setPasswordResetStep('request');
      setResetCode('');
      setResetPasswordValue('');
      setResetPasswordRepeat('');
    } catch (error) {
      setAuthError(asErrorMessage(error, UI_TEXT.errResetDefault));
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const onResendConfirmation = async () => {
    const email = (pendingConfirmationEmail || registerEmail).trim().toLowerCase();

    if (!email) {
      setAuthError(UI_TEXT.errResendEmailNoEmail);
      return;
    }

    setIsResendingConfirmation(true);
    setAuthError(null);
    setAuthInfo(null);

    try {
      await sendWidgetEmailConfirmation(email);
      setPendingConfirmationEmail(email);
      setAuthInfo(`${UI_TEXT.resendConfirmationDonePrefix} ${email}.`);
    } catch (error) {
      setAuthError(asErrorMessage(error, UI_TEXT.errResendEmailDefault));
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const onLogout = () => {
    clearWidgetAuthSession();
    setWidgetSession(null);
    setStoredActorId('');
    setStoredActorToken('');
    setAuthInfo(UI_TEXT.logoutDone);
    setAuthError(null);
  };

  return (
    <section className="auth-mode-bar">
      <h3 className="auth-title">{widgetSession ? UI_TEXT.accountTitle : UI_TEXT.title}</h3>

      {widgetSession ? (
        <div className="auth-session auth-account-card">
          <div className="auth-account-summary">
            <p className="meta auth-account-label">
              {UI_TEXT.loggedInAsPrefix}
            </p>
            <p className="auth-account-name">{getDisplayName(widgetSession)}</p>
            {widgetSession.user.email ? (
              <p className="auth-account-email">
                {UI_TEXT.emailLabel}: {widgetSession.user.email}
              </p>
            ) : null}
          </div>

          <div className="form-actions auth-account-actions">
            <button
              type="button"
              className="secondary-button account-logout-button"
              onClick={onLogout}
            >
              {UI_TEXT.logout}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="controls">
            <button
              type="button"
              className={authMode === 'login' ? 'chip chip-active' : 'chip'}
              onClick={() => {
                setAuthMode('login');
                setShowPasswordReset(false);
              }}
            >
              {UI_TEXT.loginTab}
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'chip chip-active' : 'chip'}
              onClick={() => {
                setAuthMode('register');
                setShowPasswordReset(false);
              }}
            >
              {UI_TEXT.registerTab}
            </button>
          </div>

          {authMode === 'login' ? (
            <>
              <form className="form-grid" onSubmit={onLoginSubmit}>
                <label className="field auth-mode-field">
                  <span>{UI_TEXT.emailOrUsername}</span>
                  <input
                    value={loginIdentifier}
                    onChange={(event) => setLoginIdentifier(event.target.value)}
                    placeholder="user@example.com"
                    autoComplete="username"
                    required
                  />
                </label>
                <label className="field auth-mode-field">
                  <span>{UI_TEXT.password}</span>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={authLoading}>
                    {authLoading ? UI_TEXT.loginLoading : UI_TEXT.login}
                  </button>
                  <button
                    type="button"
                    className="inline-button"
                    onClick={openPasswordReset}
                    disabled={passwordResetLoading}
                  >
                    {UI_TEXT.forgotPassword}
                  </button>
                </div>
              </form>

              {showPasswordReset ? (
                <div className="card card-detail">
                  {passwordResetStep === 'request' ? (
                    <form className="form-grid" onSubmit={onRequestPasswordReset}>
                      <label className="field auth-mode-field">
                        <span>{UI_TEXT.emailForPasswordReset}</span>
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(event) => setResetEmail(event.target.value)}
                          placeholder="user@example.com"
                          autoComplete="email"
                          required
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={passwordResetLoading}
                        >
                          {passwordResetLoading ? UI_TEXT.sendEmailLoading : UI_TEXT.sendEmail}
                        </button>
                        <button
                          type="button"
                          className="inline-button"
                          onClick={() => setShowPasswordReset(false)}
                          disabled={passwordResetLoading}
                        >
                          {UI_TEXT.cancel}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form className="form-grid" onSubmit={onConfirmPasswordReset}>
                      <label className="field auth-mode-field">
                        <span>{UI_TEXT.codeFromEmail}</span>
                        <input
                          value={resetCode}
                          onChange={(event) => setResetCode(event.target.value)}
                          placeholder="code"
                          autoComplete="one-time-code"
                          required
                        />
                      </label>
                      <label className="field auth-mode-field">
                        <span>{UI_TEXT.newPassword}</span>
                        <input
                          type="password"
                          value={resetPasswordValue}
                          onChange={(event) => setResetPasswordValue(event.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                      <label className="field auth-mode-field">
                        <span>{UI_TEXT.repeatNewPassword}</span>
                        <input
                          type="password"
                          value={resetPasswordRepeat}
                          onChange={(event) => setResetPasswordRepeat(event.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={passwordResetLoading}
                        >
                          {passwordResetLoading
                            ? UI_TEXT.resetPasswordLoading
                            : UI_TEXT.resetPassword}
                        </button>
                        <button
                          type="button"
                          className="inline-button"
                          onClick={() => setPasswordResetStep('request')}
                          disabled={passwordResetLoading}
                        >
                          {UI_TEXT.resendResetEmail}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <form className="form-grid" onSubmit={onRegisterSubmit}>
              <label className="field auth-mode-field">
                <span>{UI_TEXT.email}</span>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder="user@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="field auth-mode-field">
                <span>{UI_TEXT.username}</span>
                <input
                  value={registerUsername}
                  onChange={(event) => setRegisterUsername(event.target.value)}
                  placeholder="product_user"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="field auth-mode-field">
                <span>{UI_TEXT.password}</span>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="field auth-mode-field">
                <span>{UI_TEXT.repeatPassword}</span>
                <input
                  type="password"
                  value={registerPasswordRepeat}
                  onChange={(event) => setRegisterPasswordRepeat(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={authLoading}>
                  {authLoading ? UI_TEXT.registerLoading : UI_TEXT.register}
                </button>
              </div>
            </form>
          )}

          {pendingConfirmationEmail ? (
            <div className="form-actions">
              <span className="meta">
                {UI_TEXT.pendingConfirmationPrefix} {pendingConfirmationEmail}
              </span>
              <button
                type="button"
                className="inline-button"
                onClick={() => void onResendConfirmation()}
                disabled={isResendingConfirmation}
              >
                {isResendingConfirmation
                  ? UI_TEXT.resendConfirmationLoading
                  : UI_TEXT.resendConfirmation}
              </button>
            </div>
          ) : null}
        </>
      )}

      {authError ? <p className="state state-error">{authError}</p> : null}
      {authInfo ? <p className="form-info">{authInfo}</p> : null}
    </section>
  );
};

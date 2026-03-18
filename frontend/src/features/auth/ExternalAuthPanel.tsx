import type { PublicWriteAuthMode } from '../../lib/write-auth';

export const ExternalAuthPanel = ({
  actorId,
  actorToken,
  hasActorIdentity,
  onActorIdChange,
  onActorTokenChange,
  onClearActorId,
  onClearActorToken,
  publicWriteMode,
}: {
  actorId: string;
  actorToken: string;
  hasActorIdentity: boolean;
  onActorIdChange: (value: string) => void;
  onActorTokenChange: (value: string) => void;
  onClearActorId: () => void;
  onClearActorToken: () => void;
  publicWriteMode: PublicWriteAuthMode;
}) => {
  return (
    <section className="auth-mode-bar">
      <h3 className="auth-title">Внешняя авторизация</h3>
      <label className="field auth-mode-field">
        <span>Идентификатор пользователя (x-actor-id)</span>
        <input
          value={actorId}
          onChange={(event) => onActorIdChange(event.target.value)}
          placeholder="user_123"
        />
      </label>
      <label className="field auth-mode-field">
        <span>Токен пользователя (x-actor-token)</span>
        <input
          value={actorToken}
          onChange={(event) => onActorTokenChange(event.target.value)}
          placeholder="payload.signature"
        />
      </label>
      <div className="form-actions">
        <button type="button" className="inline-button" onClick={onClearActorId}>
          Очистить x-actor-id
        </button>
        <button type="button" className="inline-button" onClick={onClearActorToken}>
          Очистить x-actor-token
        </button>
      </div>
      {publicWriteMode === 'auth' && !hasActorIdentity ? (
        <p className="state state-error">Для режима авторизации нужен x-actor-id или x-actor-token.</p>
      ) : null}
    </section>
  );
};

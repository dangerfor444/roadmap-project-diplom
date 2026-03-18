import { useEffect, useState } from 'react';
import { managerApi } from '../../lib/manager-api';
import type { ManagerIdeaItem } from '../../types/manager-api';
import type { IdeaStatus } from '../../types/public-api';
import { IDEA_STATUS_LABEL, IDEA_STATUS_OPTIONS, formatDate } from '../common/meta';
import { EmptyState, ErrorState, LoadingState } from '../common/ui';
import { managerErrorMessage } from './error';

export const ManagerIdeasPage = () => {
  const [ideas, setIdeas] = useState<ManagerIdeaItem[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<number, IdeaStatus>>({});
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [busyIdeaId, setBusyIdeaId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await managerApi.getIdeas(filter === 'all' ? undefined : filter);
        if (!isCancelled) {
          setIdeas(data);
          setStatusDrafts(
            data.reduce<Record<number, IdeaStatus>>((acc, item) => {
              acc[item.id] = item.status;
              return acc;
            }, {})
          );
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(managerErrorMessage(requestError, 'Не удалось загрузить идеи в панели управления.'));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [filter]);

  const onSaveIdeaStatus = async (ideaId: number) => {
    const status = statusDrafts[ideaId];
    if (!status) return;

    setActionError(null);
    setInfo(null);
    setBusyIdeaId(ideaId);

    try {
      const updated = await managerApi.updateIdeaStatus(ideaId, status);
      setIdeas((current) => current.map((idea) => (idea.id === ideaId ? updated : idea)));
      setStatusDrafts((current) => ({ ...current, [ideaId]: updated.status }));
      setInfo(`Статус идеи #${ideaId} обновлен.`);
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, 'Не удалось обновить статус идеи.'));
    } finally {
      setBusyIdeaId(null);
    }
  };

  const onDeleteIdea = async (ideaId: number) => {
    const shouldDelete = window.confirm(`Удалить идею #${ideaId} без возможности восстановления?`);
    if (!shouldDelete) {
      return;
    }

    setActionError(null);
    setInfo(null);
    setBusyIdeaId(ideaId);

    try {
      await managerApi.deleteIdea(ideaId);
      setIdeas((current) => current.filter((idea) => idea.id !== ideaId));
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[ideaId];
        return next;
      });
      setInfo(`Идея #${ideaId} удалена.`);
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, 'Не удалось удалить идею.'));
    } finally {
      setBusyIdeaId(null);
    }
  };

  return (
    <section className="tab-content">
      <h2>Управление: идеи</h2>
      <p className="meta">Просмотр входящих идей и управление статусами обработки.</p>

      <div className="controls">
        <button
          type="button"
          className={filter === 'all' ? 'chip chip-active' : 'chip'}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        {IDEA_STATUS_OPTIONS.map((statusOption) => (
          <button
            key={statusOption.value}
            type="button"
            className={filter === statusOption.value ? 'chip chip-active' : 'chip'}
            onClick={() => setFilter(statusOption.value)}
          >
            {statusOption.label}
          </button>
        ))}
      </div>

      {actionError ? <ErrorState message={actionError} /> : null}
      {info ? <p className="form-info">{info}</p> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && ideas.length === 0 ? (
        <EmptyState message="Для выбранного фильтра идей нет." />
      ) : null}

      {!isLoading && !error && ideas.length > 0 ? (
        <div className="cards">
          {ideas.map((idea) => {
            const isBusy = busyIdeaId === idea.id;
            const currentStatus = statusDrafts[idea.id] ?? idea.status;
            return (
              <article key={idea.id} className="card">
                <header className="card-header">
                  <h3>{idea.title}</h3>
                  <span className="status">{IDEA_STATUS_LABEL[idea.status]}</span>
                </header>
                <p className="description">{idea.description}</p>
                <p className="meta">
                  Голоса: <strong>{idea.votesCount}</strong> • Создано: {formatDate(idea.createdAt)}
                </p>

                <div className="manager-toolbar">
                  <label className="field manager-inline-field">
                    <span>Статус</span>
                    <select
                      value={currentStatus}
                      onChange={(event) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [idea.id]: event.target.value as IdeaStatus,
                        }))
                      }
                    >
                      {IDEA_STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption.value} value={statusOption.value}>
                          {statusOption.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onSaveIdeaStatus(idea.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? 'Сохранение...' : 'Сохранить статус'}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => onDeleteIdea(idea.id)}
                    disabled={isBusy}
                  >
                    Удалить идею
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { managerApi } from '../../lib/manager-api';
import type { ManagerCommentItem, ManagerCommentTarget } from '../../types/manager-api';
import { formatDate } from '../common/meta';
import { EmptyState, ErrorState, LoadingState } from '../common/ui';
import { managerErrorMessage } from './error';

type ParentScope = {
  key: string;
  target: ManagerCommentTarget;
  parentId: number | null;
  parentTitle: string | null;
  parentStatus: string | null;
  parentExists: boolean;
  commentsCount: number;
  lastCommentAt: string;
};

const IDEA_STATUS_LABEL: Record<string, string> = {
  new: 'Новая',
  under_review: 'На рассмотрении',
  planned: 'Запланирована',
  declined: 'Отклонена',
  done: 'Реализована',
};

const ROADMAP_STATUS_LABEL: Record<string, string> = {
  planned: 'Запланировано',
  in_progress: 'В работе',
  done: 'Реализовано',
};

const toParentKey = (comment: ManagerCommentItem): string =>
  `${comment.target}:${comment.parentId === null ? 'missing' : comment.parentId}`;

const resolveParentStatusLabel = (
  target: ManagerCommentTarget,
  status: string | null,
  parentExists: boolean
): string => {
  if (!parentExists) return 'Родитель удален';
  if (!status) return 'Статус не указан';
  if (target === 'idea') return IDEA_STATUS_LABEL[status] ?? status;
  return ROADMAP_STATUS_LABEL[status] ?? status;
};

const resolveParentTitle = (scope: ParentScope): string => {
  if (!scope.parentExists) return 'Родитель удален';
  if (scope.parentTitle) return scope.parentTitle;
  return `ID ${scope.parentId ?? '-'}`;
};

export const ManagerModerationPage = () => {
  const [comments, setComments] = useState<ManagerCommentItem[]>([]);
  const [target, setTarget] = useState<ManagerCommentTarget | 'all'>('all');
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [selectedParentKey, setSelectedParentKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [busyCommentKey, setBusyCommentKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadComments = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await managerApi.getComments({
        target: target === 'all' ? undefined : target,
        isHidden: visibility === 'all' ? undefined : visibility === 'hidden',
      });
      setComments(data);
    } catch (requestError) {
      setError(
        managerErrorMessage(
          requestError,
          'Не удалось загрузить комментарии в панели управления.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, [target, visibility]);

  const parentScopes = useMemo<ParentScope[]>(() => {
    const map = new Map<string, ParentScope>();

    for (const comment of comments) {
      const key = toParentKey(comment);
      const existing = map.get(key);

      if (existing) {
        existing.commentsCount += 1;
        if (String(comment.createdAt) > String(existing.lastCommentAt)) {
          existing.lastCommentAt = comment.createdAt;
        }
        continue;
      }

      map.set(key, {
        key,
        target: comment.target,
        parentId: comment.parentId,
        parentTitle: comment.parentTitle,
        parentStatus: comment.parentStatus,
        parentExists: comment.parentExists,
        commentsCount: 1,
        lastCommentAt: comment.createdAt,
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      String(b.lastCommentAt).localeCompare(String(a.lastCommentAt))
    );
  }, [comments]);

  useEffect(() => {
    if (!selectedParentKey) return;
    if (!parentScopes.some((scope) => scope.key === selectedParentKey)) {
      setSelectedParentKey(null);
    }
  }, [parentScopes, selectedParentKey]);

  const selectedParent = useMemo(
    () => parentScopes.find((scope) => scope.key === selectedParentKey) ?? null,
    [parentScopes, selectedParentKey]
  );

  const selectedComments = useMemo(
    () =>
      selectedParentKey
        ? comments.filter((comment) => toParentKey(comment) === selectedParentKey)
        : [],
    [comments, selectedParentKey]
  );

  const onModerateComment = async (comment: ManagerCommentItem, isHidden: boolean) => {
    const commentKey = `${comment.target}:${comment.id}`;
    setActionError(null);
    setInfo(null);
    setBusyCommentKey(commentKey);

    try {
      await managerApi.moderateComment(comment.target, comment.id, isHidden);
      await loadComments();
      setInfo(`Комментарий #${comment.id} теперь ${isHidden ? 'скрыт' : 'видим'}.`);
    } catch (requestError) {
      setActionError(
        managerErrorMessage(requestError, 'Не удалось изменить видимость комментария.')
      );
    } finally {
      setBusyCommentKey(null);
    }
  };

  const onDeleteComment = async (comment: ManagerCommentItem) => {
    const shouldDelete = window.confirm(
      `Удалить комментарий #${comment.id} без возможности восстановления?`
    );
    if (!shouldDelete) return;

    const commentKey = `${comment.target}:${comment.id}`;
    setActionError(null);
    setInfo(null);
    setBusyCommentKey(commentKey);

    try {
      await managerApi.deleteComment(comment.target, comment.id);
      await loadComments();
      setInfo(`Комментарий #${comment.id} удален.`);
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, 'Не удалось удалить комментарий.'));
    } finally {
      setBusyCommentKey(null);
    }
  };

  return (
    <section className="tab-content">
      <h2>Управление: модерация комментариев</h2>
      <p className="meta">
        Список показывает только идеи и элементы roadmap, у которых есть комментарии.
      </p>

      <div className="controls">
        <button
          type="button"
          className={target === 'all' ? 'chip chip-active' : 'chip'}
          onClick={() => setTarget('all')}
        >
          Все типы
        </button>
        <button
          type="button"
          className={target === 'idea' ? 'chip chip-active' : 'chip'}
          onClick={() => setTarget('idea')}
        >
          Идеи
        </button>
        <button
          type="button"
          className={target === 'roadmap' ? 'chip chip-active' : 'chip'}
          onClick={() => setTarget('roadmap')}
        >
          roadmap
        </button>
      </div>

      <div className="controls">
        <button
          type="button"
          className={visibility === 'all' ? 'chip chip-active' : 'chip'}
          onClick={() => setVisibility('all')}
        >
          Любая видимость
        </button>
        <button
          type="button"
          className={visibility === 'visible' ? 'chip chip-active' : 'chip'}
          onClick={() => setVisibility('visible')}
        >
          Только видимые
        </button>
        <button
          type="button"
          className={visibility === 'hidden' ? 'chip chip-active' : 'chip'}
          onClick={() => setVisibility('hidden')}
        >
          Только скрытые
        </button>
      </div>

      {actionError ? <ErrorState message={actionError} /> : null}
      {info ? <p className="form-info">{info}</p> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && parentScopes.length === 0 ? (
        <EmptyState message="По выбранным фильтрам элементов с комментариями нет." />
      ) : null}

      {!isLoading && !error && parentScopes.length > 0 ? (
        <div className="cards">
          {parentScopes.map((scope) => (
            <article key={scope.key} className="card">
              <header className="card-header">
                <h3>
                  {scope.target === 'idea' ? 'Идея' : 'roadmap'}: {resolveParentTitle(scope)}
                </h3>
                <span className="status">
                  {resolveParentStatusLabel(scope.target, scope.parentStatus, scope.parentExists)}
                </span>
              </header>
              <p className="meta">
                Комментариев: <strong>{scope.commentsCount}</strong> • Последний:{' '}
                {formatDate(scope.lastCommentAt)} • ID: <strong>{scope.parentId ?? '-'}</strong>
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setSelectedParentKey(scope.key)}
                >
                  Открыть комментарии
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {selectedParent ? (
        <div className="modal-backdrop" onClick={() => setSelectedParentKey(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  {selectedParent.target === 'idea' ? 'Идея' : 'roadmap'}:{' '}
                  {resolveParentTitle(selectedParent)}
                </h3>
                <p className="meta">
                  Статус:{' '}
                  <strong>
                    {resolveParentStatusLabel(
                      selectedParent.target,
                      selectedParent.parentStatus,
                      selectedParent.parentExists
                    )}
                  </strong>{' '}
                  • Комментариев: <strong>{selectedComments.length}</strong>
                </p>
              </div>
              <button
                type="button"
                className="inline-button"
                onClick={() => setSelectedParentKey(null)}
              >
                Закрыть
              </button>
            </div>

            {selectedComments.length === 0 ? (
              <EmptyState message="У выбранного элемента нет комментариев по текущим фильтрам." />
            ) : (
              <div className="cards">
                {selectedComments.map((comment) => {
                  const commentKey = `${comment.target}:${comment.id}`;
                  const isBusy = busyCommentKey === commentKey;

                  return (
                    <article key={commentKey} className="card">
                      <header className="card-header">
                        <h3>Комментарий #{comment.id}</h3>
                        <span className="status">{comment.isHidden ? 'Скрыт' : 'Видим'}</span>
                      </header>
                      <p className="meta">{formatDate(comment.createdAt)}</p>
                      <p className="description">{comment.text}</p>
                      <p className="meta">Автор: {comment.authorName}</p>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => onModerateComment(comment, !comment.isHidden)}
                          disabled={isBusy}
                        >
                          {isBusy
                            ? 'Сохранение...'
                            : comment.isHidden
                              ? 'Сделать видимым'
                              : 'Скрыть'}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => onDeleteComment(comment)}
                          disabled={isBusy}
                        >
                          Удалить комментарий
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};

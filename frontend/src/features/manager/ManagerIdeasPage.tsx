import { useEffect, useState } from 'react';
import { managerApi } from '../../lib/manager-api';
import type { ManagerCommentItem, ManagerIdeaDetails, ManagerIdeaItem } from '../../types/manager-api';
import type { IdeaStatus } from '../../types/public-api';
import { IDEA_STATUS_LABEL, IDEA_STATUS_OPTIONS, formatDate } from '../common/meta';
import { EmptyState, ErrorState, LoadingState } from '../common/ui';
import { managerErrorMessage } from './error';

const UI_TEXT = {
  pageTitle: 'Управление: идеи',
  pageSubtitle: 'Просмотр входящих идей, смена статусов и модерация комментариев в одном месте.',
  allFilter: 'Все',
  loadError: 'Не удалось загрузить идеи в панели управления.',
  loadDetailsError: 'Не удалось загрузить детали идеи.',
  saveStatusError: 'Не удалось обновить статус идеи.',
  saveStatusSuccess: 'Статус идеи #{id} обновлён.',
  toggleVisibilityError: 'Не удалось изменить видимость идеи.',
  toggleVisibilitySuccess: 'Видимость идеи #{id} обновлена.',
  deleteError: 'Не удалось удалить идею.',
  deleteSuccess: 'Идея #{id} удалена.',
  deleteConfirm: 'Удалить идею #{id} без возможности восстановления?',
  commentVisibilityError: 'Не удалось изменить видимость комментария.',
  commentVisibilitySuccess: 'Видимость комментария #{id} обновлена.',
  deleteCommentError: 'Не удалось удалить комментарий.',
  deleteCommentSuccess: 'Комментарий #{id} удалён.',
  deleteCommentConfirm: 'Удалить комментарий #{id} без возможности восстановления?',
  empty: 'Для выбранного фильтра идей нет.',
  noComments: 'Комментариев к этой идее пока нет.',
  votesLabel: 'Лайков',
  createdAtLabel: 'Создано',
  statusLabel: 'Статус',
  authorLabel: 'Автор',
  commentsLabel: 'Комментарии',
  commentsTitle: 'Комментарии к идее',
  saveStatusButton: 'Сохранить статус',
  savingButton: 'Сохранение...',
  hideButton: 'Скрыть',
  showButton: 'Показать',
  deleteButton: 'Удалить идею',
  deleteCommentButton: 'Удалить комментарий',
  hiddenBadge: 'Скрыта',
  hiddenLabel: 'Скрыт',
  closeButton: 'Закрыть',
  clickHint: 'Нажмите, чтобы открыть действия',
  idPrefix: 'ID',
} as const;

export const ManagerIdeasPage = () => {
  const [ideas, setIdeas] = useState<ManagerIdeaItem[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<number, IdeaStatus>>({});
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [busyIdeaId, setBusyIdeaId] = useState<number | null>(null);
  const [busyCommentKey, setBusyCommentKey] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<ManagerIdeaDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadIdeas = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await managerApi.getIdeas(filter === 'all' ? undefined : filter);
      setIdeas(data);
      setStatusDrafts(
        data.reduce<Record<number, IdeaStatus>>((acc, item) => {
          acc[item.id] = item.status;
          return acc;
        }, {})
      );
    } catch (requestError) {
      setError(managerErrorMessage(requestError, UI_TEXT.loadError));
    } finally {
      setIsLoading(false);
    }
  };

  const loadIdeaDetails = async (ideaId: number) => {
    setIsDetailsLoading(true);
    setDetailsError(null);

    try {
      const details = await managerApi.getIdeaDetails(ideaId);
      setSelectedDetails(details);
      setStatusDrafts((current) => ({
        ...current,
        [ideaId]: details.status,
      }));
    } catch (requestError) {
      setDetailsError(managerErrorMessage(requestError, UI_TEXT.loadDetailsError));
    } finally {
      setIsDetailsLoading(false);
    }
  };

  useEffect(() => {
    void loadIdeas();
  }, [filter]);

  useEffect(() => {
    if (selectedIdeaId === null) {
      setSelectedDetails(null);
      setDetailsError(null);
      return;
    }

    void loadIdeaDetails(selectedIdeaId);
  }, [selectedIdeaId]);

  useEffect(() => {
    if (selectedIdeaId === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedIdeaId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIdeaId]);

  const selectedIdea =
    selectedIdeaId !== null ? ideas.find((idea) => idea.id === selectedIdeaId) ?? null : null;

  const refreshSelectedDetails = async (ideaId: number) => {
    const details = await managerApi.getIdeaDetails(ideaId);
    setSelectedDetails(details);
    setIdeas((current) =>
      current.map((idea) =>
        idea.id === ideaId
          ? {
              ...idea,
              title: details.title,
              description: details.description,
              status: details.status,
              votesCount: details.votesCount,
              commentsCount: details.commentsCount,
              authorName: details.authorName,
              isHidden: details.isHidden,
              updatedAt: details.updatedAt,
            }
          : idea
      )
    );
    setStatusDrafts((current) => ({
      ...current,
      [ideaId]: details.status,
    }));
  };

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
      setSelectedDetails((current) =>
        current && current.id === ideaId ? { ...current, ...updated } : current
      );
      setInfo(UI_TEXT.saveStatusSuccess.replace('{id}', String(ideaId)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.saveStatusError));
    } finally {
      setBusyIdeaId(null);
    }
  };

  const onToggleVisibility = async (ideaId: number, isHidden: boolean) => {
    setActionError(null);
    setInfo(null);
    setBusyIdeaId(ideaId);

    try {
      const updated = await managerApi.updateIdeaVisibility(ideaId, !isHidden);
      setIdeas((current) => current.map((idea) => (idea.id === ideaId ? updated : idea)));
      setStatusDrafts((current) => ({ ...current, [ideaId]: updated.status }));
      setSelectedDetails((current) =>
        current && current.id === ideaId ? { ...current, ...updated } : current
      );
      setInfo(UI_TEXT.toggleVisibilitySuccess.replace('{id}', String(ideaId)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.toggleVisibilityError));
    } finally {
      setBusyIdeaId(null);
    }
  };

  const onDeleteIdea = async (ideaId: number) => {
    const shouldDelete = window.confirm(UI_TEXT.deleteConfirm.replace('{id}', String(ideaId)));
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
      if (selectedIdeaId === ideaId) {
        setSelectedIdeaId(null);
      }
      setInfo(UI_TEXT.deleteSuccess.replace('{id}', String(ideaId)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.deleteError));
    } finally {
      setBusyIdeaId(null);
    }
  };

  const onModerateComment = async (comment: ManagerCommentItem, isHidden: boolean) => {
    if (!selectedIdea) return;

    const commentKey = `${comment.target}:${comment.id}`;
    setActionError(null);
    setInfo(null);
    setBusyCommentKey(commentKey);

    try {
      await managerApi.moderateComment(comment.target, comment.id, isHidden);
      await refreshSelectedDetails(selectedIdea.id);
      setInfo(UI_TEXT.commentVisibilitySuccess.replace('{id}', String(comment.id)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.commentVisibilityError));
    } finally {
      setBusyCommentKey(null);
    }
  };

  const onDeleteComment = async (comment: ManagerCommentItem) => {
    if (!selectedIdea) return;
    if (!window.confirm(UI_TEXT.deleteCommentConfirm.replace('{id}', String(comment.id)))) {
      return;
    }

    const commentKey = `${comment.target}:${comment.id}`;
    setActionError(null);
    setInfo(null);
    setBusyCommentKey(commentKey);

    try {
      await managerApi.deleteComment(comment.target, comment.id);
      await refreshSelectedDetails(selectedIdea.id);
      setInfo(UI_TEXT.deleteCommentSuccess.replace('{id}', String(comment.id)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.deleteCommentError));
    } finally {
      setBusyCommentKey(null);
    }
  };

  return (
    <section className="tab-content">
      <h2>{UI_TEXT.pageTitle}</h2>
      <p className="meta">{UI_TEXT.pageSubtitle}</p>

      <div className="controls">
        <button
          type="button"
          className={filter === 'all' ? 'chip chip-active' : 'chip'}
          onClick={() => setFilter('all')}
        >
          {UI_TEXT.allFilter}
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
      {!isLoading && !error && ideas.length === 0 ? <EmptyState message={UI_TEXT.empty} /> : null}

      {!isLoading && !error && ideas.length > 0 ? (
        <div className="idea-grid manager-ideas-grid">
          {ideas.map((idea) => (
            <article
              key={idea.id}
              className="card idea-card idea-card-compact idea-card-clickable manager-idea-card"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedIdeaId(idea.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedIdeaId(idea.id);
                }
              }}
            >
              <div className="manager-idea-card-top">
                <span className="status">{IDEA_STATUS_LABEL[idea.status]}</span>
                {idea.isHidden ? (
                  <span className="status status-hidden">{UI_TEXT.hiddenBadge}</span>
                ) : null}
              </div>

              <h3>{idea.title}</h3>
              <p className="meta">
                {UI_TEXT.authorLabel}: <strong>{idea.authorName}</strong>
              </p>
              <p className="meta idea-card-meta">
                {UI_TEXT.votesLabel}: <strong>{idea.votesCount}</strong> {' • '}
                {UI_TEXT.commentsLabel}: <strong>{idea.commentsCount}</strong>
              </p>
              <p className="meta idea-card-date">
                {UI_TEXT.createdAtLabel}: {formatDate(idea.createdAt)}
              </p>
              <p className="manager-roadmap-card-hint">{UI_TEXT.clickHint}</p>
            </article>
          ))}
        </div>
      ) : null}

      {selectedIdea ? (
        <div className="modal-backdrop" onClick={() => setSelectedIdeaId(null)}>
          <div className="modal-card modal-card-large" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="auth-title">{selectedDetails?.title ?? selectedIdea.title}</h3>
                <p className="meta">
                  {UI_TEXT.authorLabel}: <strong>{selectedDetails?.authorName ?? selectedIdea.authorName}</strong>
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedIdeaId(null)}
              >
                {UI_TEXT.closeButton}
              </button>
            </div>

            {detailsError ? <ErrorState message={detailsError} /> : null}
            {isDetailsLoading ? <LoadingState /> : null}

            {!isDetailsLoading && !detailsError ? (
              <>
                {actionError ? <ErrorState message={actionError} /> : null}
                {info ? <p className="form-info">{info}</p> : null}

                <article className="card">
                  <div className="manager-idea-card-top manager-idea-modal-top">
                    <span className="status">
                      {IDEA_STATUS_LABEL[selectedDetails?.status ?? selectedIdea.status]}
                    </span>
                    {(selectedDetails?.isHidden ?? selectedIdea.isHidden) ? (
                      <span className="status status-hidden">{UI_TEXT.hiddenBadge}</span>
                    ) : null}
                  </div>

                  <p className="description">{selectedDetails?.description ?? selectedIdea.description}</p>
                  <p className="meta">
                    {UI_TEXT.votesLabel}: <strong>{selectedDetails?.votesCount ?? selectedIdea.votesCount}</strong>
                    {' • '}
                    {UI_TEXT.commentsLabel}: <strong>{selectedDetails?.commentsCount ?? selectedIdea.commentsCount}</strong>
                    {' • '}
                    {UI_TEXT.createdAtLabel}: {formatDate(selectedDetails?.createdAt ?? selectedIdea.createdAt)}
                  </p>

                  <div className="manager-toolbar">
                    <label className="field manager-inline-field">
                      <span>{UI_TEXT.statusLabel}</span>
                      <select
                        value={statusDrafts[selectedIdea.id] ?? selectedIdea.status}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [selectedIdea.id]: event.target.value as IdeaStatus,
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
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onSaveIdeaStatus(selectedIdea.id)}
                      disabled={busyIdeaId === selectedIdea.id}
                    >
                      {busyIdeaId === selectedIdea.id ? UI_TEXT.savingButton : UI_TEXT.saveStatusButton}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        onToggleVisibility(selectedIdea.id, selectedDetails?.isHidden ?? selectedIdea.isHidden)
                      }
                      disabled={busyIdeaId === selectedIdea.id}
                    >
                      {(selectedDetails?.isHidden ?? selectedIdea.isHidden)
                        ? UI_TEXT.showButton
                        : UI_TEXT.hideButton}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => onDeleteIdea(selectedIdea.id)}
                      disabled={busyIdeaId === selectedIdea.id}
                    >
                      {UI_TEXT.deleteButton}
                    </button>
                  </div>
                </article>

                <section className="manager-inline-comments">
                  <div className="section-header manager-inline-comments-header">
                    <div>
                      <h3>{UI_TEXT.commentsTitle}</h3>
                      <p className="meta">
                        {UI_TEXT.commentsLabel}: <strong>{selectedDetails?.comments.length ?? 0}</strong>
                      </p>
                    </div>
                  </div>

                  {!selectedDetails || selectedDetails.comments.length === 0 ? (
                    <EmptyState message={UI_TEXT.noComments} />
                  ) : (
                    <div className="manager-comment-list">
                      {selectedDetails.comments.map((comment) => {
                        const commentKey = `${comment.target}:${comment.id}`;
                        const isBusy = busyCommentKey === commentKey;

                        return (
                          <article key={commentKey} className="card manager-comment-card">
                            <header className="manager-comment-card-top">
                              <div>
                                <h3 className="manager-comment-card-title">
                                  {UI_TEXT.idPrefix} {comment.id}
                                </h3>
                                <p className="meta">
                                  {UI_TEXT.authorLabel}: <strong>{comment.authorName}</strong>
                                  {' • '}
                                  {formatDate(comment.createdAt)}
                                </p>
                              </div>
                              {comment.isHidden ? (
                                <span className="status status-hidden">{UI_TEXT.hiddenLabel}</span>
                              ) : null}
                            </header>

                            <p className="description">{comment.text}</p>

                            <div className="form-actions">
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => onModerateComment(comment, !comment.isHidden)}
                                disabled={isBusy}
                              >
                                {isBusy
                                  ? UI_TEXT.savingButton
                                  : comment.isHidden
                                    ? UI_TEXT.showButton
                                    : UI_TEXT.hideButton}
                              </button>
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => onDeleteComment(comment)}
                                disabled={isBusy}
                              >
                                {UI_TEXT.deleteCommentButton}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

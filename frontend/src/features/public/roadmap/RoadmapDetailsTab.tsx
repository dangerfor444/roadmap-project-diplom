import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ApiError, isAuthRequiredError, publicApi } from '../../../lib/api';
import { getWriteStorageIdentity } from '../../../lib/write-auth';
import type { RoadmapDetails } from '../../../types/public-api';
import { ROADMAP_STATUS_LABEL, formatDate } from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';

const UI_TEXT = {
  title: 'Roadmap',
  subtitle: 'Обсуждение и реакции на опубликованный элемент roadmap.',
  back: 'Вернуться к roadmap',
  loadError: 'Не удалось загрузить детали элемента roadmap.',
  categoryPrefix: 'Категория',
  votes: 'Лайков',
  comments: 'Комментариев',
  createdAt: 'Создано',
  likeAria: 'Поставить лайк',
  unlikeAria: 'Убрать лайк',
  tooManyRequests: 'Слишком много запросов.',
  retryAfterPrefix: ' Повторите через ',
  retryAfterSuffix: ' с.',
  voteError: 'Не удалось обновить лайк.',
  commentLengthError: 'Комментарий должен быть от 1 до 2000 символов.',
  commentSuccess: 'Комментарий добавлен.',
  commentError: 'Не удалось добавить комментарий.',
  commentsTitle: 'Комментарии',
  emptyComments: 'Комментариев пока нет.',
  addComment: 'Добавить комментарий',
  sendComment: 'Отправить комментарий',
  sending: 'Отправка...',
} as const;

export const RoadmapDetailsTab = ({
  roadmapItemId,
  onBack,
  userFingerprint,
}: {
  roadmapItemId: number;
  onBack: () => void;
  userFingerprint: string;
}) => {
  const [item, setItem] = useState<RoadmapDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState<string>('');
  const [isCommentSubmitting, setIsCommentSubmitting] = useState<boolean>(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentInfo, setCommentInfo] = useState<string | null>(null);

  const votedKey = `roadmap:item:voted:${roadmapItemId}:${getWriteStorageIdentity(userFingerprint)}`;
  const [alreadyVoted, setAlreadyVoted] = useState<boolean>(
    () => localStorage.getItem(votedKey) === '1'
  );

  useEffect(() => {
    setAlreadyVoted(localStorage.getItem(votedKey) === '1');
  }, [votedKey]);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextItem = await publicApi.getRoadmapDetails(roadmapItemId);
        if (!isCancelled) {
          setItem(nextItem);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(errorMessage(requestError, UI_TEXT.loadError));
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
  }, [roadmapItemId]);

  const onToggleVote = async () => {
    if (isVoting) {
      return;
    }

    setVoteError(null);
    setIsVoting(true);

    try {
      if (alreadyVoted) {
        const result = await publicApi.unvoteRoadmapItem(roadmapItemId, userFingerprint);
        localStorage.removeItem(votedKey);
        setAlreadyVoted(false);
        setItem((current) => (current ? { ...current, votesCount: result.votesCount } : current));
      } else {
        const result = await publicApi.voteRoadmapItem(roadmapItemId, userFingerprint);
        localStorage.setItem(votedKey, '1');
        setAlreadyVoted(true);
        setItem((current) => (current ? { ...current, votesCount: result.votesCount } : current));
      }
    } catch (requestError) {
      if (isAuthRequiredError(requestError)) {
        return;
      }

      if (!alreadyVoted && requestError instanceof ApiError && requestError.status === 409) {
        localStorage.setItem(votedKey, '1');
        setAlreadyVoted(true);
      } else if (requestError instanceof ApiError && requestError.status === 429) {
        const retryHint =
          requestError.retryAfterSeconds !== null
            ? `${UI_TEXT.retryAfterPrefix}${requestError.retryAfterSeconds}${UI_TEXT.retryAfterSuffix}`
            : '';
        setVoteError(`${UI_TEXT.tooManyRequests}${retryHint}`);
      } else {
        setVoteError(errorMessage(requestError, UI_TEXT.voteError));
      }
    } finally {
      setIsVoting(false);
    }
  };

  const onSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCommentError(null);
    setCommentInfo(null);

    const safeText = commentText.trim();
    if (safeText.length < 1 || safeText.length > 2000) {
      setCommentError(UI_TEXT.commentLengthError);
      return;
    }

    setIsCommentSubmitting(true);
    try {
      const newComment = await publicApi.createRoadmapComment(roadmapItemId, {
        text: safeText,
        userFingerprint,
      });

      setCommentText('');
      setCommentInfo(UI_TEXT.commentSuccess);
      setItem((current) =>
        current
          ? {
              ...current,
              commentsCount: newComment.commentsCount,
              comments: [...current.comments, newComment],
            }
          : current
      );
    } catch (requestError) {
      if (isAuthRequiredError(requestError)) {
        return;
      }

      if (requestError instanceof ApiError && requestError.status === 429) {
        const retryHint =
          requestError.retryAfterSeconds !== null
            ? `${UI_TEXT.retryAfterPrefix}${requestError.retryAfterSeconds}${UI_TEXT.retryAfterSuffix}`
            : '';
        setCommentError(`${UI_TEXT.tooManyRequests}${retryHint}`);
      } else {
        setCommentError(errorMessage(requestError, UI_TEXT.commentError));
      }
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  return (
    <section className="tab-content">
      <div className="section-header detail-header">
        <div className="page-hero">
          <h2>{UI_TEXT.title}</h2>
          <p className="meta">{UI_TEXT.subtitle}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBack}>
          {UI_TEXT.back}
        </button>
      </div>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && item ? (
        <article className="card card-detail">
          <header className="card-header">
            <h3>{item.title}</h3>
            <span className="status">{ROADMAP_STATUS_LABEL[item.status]}</span>
          </header>

          <p className="description">{item.description}</p>

          <div className="detail-summary">
            {item.category ? (
              <p className="meta">
                {UI_TEXT.categoryPrefix}: <strong>{item.category}</strong>
              </p>
            ) : null}
            <p className="meta">
              {UI_TEXT.votes}: <strong>{item.votesCount}</strong>
            </p>
            <p className="meta">
              {UI_TEXT.comments}: <strong>{item.commentsCount}</strong>
            </p>
            <p className="meta">
              {UI_TEXT.createdAt}: {formatDate(item.createdAt)}
            </p>
          </div>

          <div className="vote-block">
            <button
              type="button"
              className={alreadyVoted ? 'reaction-button reaction-button-active' : 'reaction-button'}
              onClick={onToggleVote}
              disabled={isVoting}
              aria-label={alreadyVoted ? UI_TEXT.unlikeAria : UI_TEXT.likeAria}
            >
              <span className="reaction-icon" aria-hidden="true">
                {alreadyVoted ? '♥' : '♡'}
              </span>
              <span className="reaction-count">{item.votesCount}</span>
            </button>
            {voteError ? <ErrorState message={voteError} /> : null}
          </div>

          <section className="detail-section">
            <div className="section-header detail-section-header">
              <h4>{UI_TEXT.commentsTitle}</h4>
              <p className="meta">
                {UI_TEXT.comments}: <strong>{item.commentsCount}</strong>
              </p>
            </div>

            {item.comments.length === 0 ? (
              <EmptyState message={UI_TEXT.emptyComments} />
            ) : (
              <ul className="comment-list">
                {item.comments.map((comment) => (
                  <li key={comment.id} className="comment-item">
                    <small className="comment-author">{comment.authorName}</small>
                    <p>{comment.text}</p>
                    <small>{formatDate(comment.createdAt)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="detail-section">
            <form className="form-grid compact-form" onSubmit={onSubmitComment}>
              <label className="field">
                <span>{UI_TEXT.addComment}</span>
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  minLength={1}
                  maxLength={2000}
                  rows={3}
                  required
                />
              </label>

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={isCommentSubmitting}>
                  {isCommentSubmitting ? UI_TEXT.sending : UI_TEXT.sendComment}
                </button>
                {commentInfo ? <span className="form-info">{commentInfo}</span> : null}
              </div>
              {commentError ? <ErrorState message={commentError} /> : null}
            </form>
          </section>
        </article>
      ) : null}
    </section>
  );
};

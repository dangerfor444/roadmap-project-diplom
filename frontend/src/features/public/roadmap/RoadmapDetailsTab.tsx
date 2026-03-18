import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ApiError, isAuthRequiredError, publicApi } from '../../../lib/api';
import { getWriteStorageIdentity } from '../../../lib/write-auth';
import type { RoadmapDetails } from '../../../types/public-api';
import { ROADMAP_STATUS_LABEL, formatDate } from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';

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
          setError(errorMessage(requestError, 'Не удалось загрузить детали элемента roadmap.'));
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
            ? ` Повторите через ${requestError.retryAfterSeconds} с.`
            : '';
        setVoteError(`Слишком много запросов.${retryHint}`);
      } else {
        setVoteError(errorMessage(requestError, 'Не удалось обновить лайк.'));
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
      setCommentError('Комментарий должен быть от 1 до 2000 символов.');
      return;
    }

    setIsCommentSubmitting(true);
    try {
      const newComment = await publicApi.createRoadmapComment(roadmapItemId, {
        text: safeText,
        userFingerprint,
      });

      setCommentText('');
      setCommentInfo('Комментарий добавлен.');
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
            ? ` Повторите через ${requestError.retryAfterSeconds} с.`
            : '';
        setCommentError(`Слишком много запросов.${retryHint}`);
      } else {
        setCommentError(errorMessage(requestError, 'Не удалось добавить комментарий.'));
      }
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  return (
    <section className="tab-content">
      <h2>Обсуждение элемента roadmap</h2>
      <button type="button" className="inline-button" onClick={onBack}>
        Назад к дорожной карте
      </button>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && item ? (
        <article className="card card-detail">
          <header className="card-header">
            <h3>{item.title}</h3>
            <span className="status">{ROADMAP_STATUS_LABEL[item.status]}</span>
          </header>

          <p className="description">{item.description}</p>
          <p className="meta">
            {item.category ? `Категория: ${item.category} • ` : ''}
            Голоса: <strong>{item.votesCount}</strong> • Комментариев: <strong>{item.commentsCount}</strong>{' '}
            • {formatDate(item.createdAt)}
          </p>

          <div className="vote-block">
            <button
              type="button"
              className={alreadyVoted ? 'reaction-button reaction-button-active' : 'reaction-button'}
              onClick={onToggleVote}
              disabled={isVoting}
              aria-label={alreadyVoted ? 'Убрать лайк' : 'Поставить лайк'}
            >
              <span className="reaction-icon" aria-hidden="true">
                {alreadyVoted ? '♥' : '♡'}
              </span>
              <span className="reaction-count">{item.votesCount}</span>
            </button>
            {voteError ? <ErrorState message={voteError} /> : null}
          </div>

          <h4>Комментарии</h4>
          {item.comments.length === 0 ? (
            <EmptyState message="Комментариев пока нет." />
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

          <form className="form-grid compact-form" onSubmit={onSubmitComment}>
            <label className="field">
              <span>Добавить комментарий</span>
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
                {isCommentSubmitting ? 'Отправка...' : 'Отправить комментарий'}
              </button>
              {commentInfo ? <span className="form-info">{commentInfo}</span> : null}
            </div>
            {commentError ? <ErrorState message={commentError} /> : null}
          </form>
        </article>
      ) : null}
    </section>
  );
};

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ApiError, isAuthRequiredError, publicApi } from '../../../lib/api';
import type { IdeaSort, IdeaSummary } from '../../../types/public-api';
import { IDEAS_SORTS, IDEA_STATUS_LABEL, formatDate } from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';
import { IdeaDetailsTab } from './IdeaDetailsTab';

export const IdeasTab = ({ userFingerprint }: { userFingerprint: string }) => {
  const [sort, setSort] = useState<IdeaSort>('top');
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);

  const loadIdeas = async (selectedSort: IdeaSort) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextIdeas = await publicApi.getIdeas(selectedSort);
      setIdeas(nextIdeas);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Не удалось загрузить идеи.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const nextIdeas = await publicApi.getIdeas(sort);
        if (!isCancelled) {
          setIdeas(nextIdeas);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(errorMessage(requestError, 'Не удалось загрузить идеи.'));
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
  }, [sort]);

  const onSubmitIdea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitInfo(null);

    const safeTitle = title.trim();
    const safeDescription = description.trim();

    if (safeTitle.length < 3 || safeTitle.length > 140) {
      setSubmitError('Заголовок должен быть от 3 до 140 символов.');
      return;
    }

    if (safeDescription.length < 3 || safeDescription.length > 3000) {
      setSubmitError('Описание должно быть от 3 до 3000 символов.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdIdea = await publicApi.createIdea({
        title: safeTitle,
        description: safeDescription,
        userFingerprint,
      });

      setTitle('');
      setDescription('');
      setSubmitInfo('Идея отправлена.');

      if (sort === 'new') {
        setIdeas((current) => [createdIdea, ...current]);
      } else {
        await loadIdeas(sort);
      }
    } catch (requestError) {
      if (isAuthRequiredError(requestError)) {
        return;
      }

      if (requestError instanceof ApiError && requestError.status === 429) {
        const retryHint =
          requestError.retryAfterSeconds !== null
            ? ` Повторите через ${requestError.retryAfterSeconds} с.`
            : '';
        setSubmitError(`Слишком много запросов.${retryHint}`);
      } else {
        setSubmitError(errorMessage(requestError, 'Не удалось отправить идею.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tab-content">
      <h2>Идеи</h2>

      <article className="card form-card">
        <h3>Предложить идею</h3>
        <form className="form-grid" onSubmit={onSubmitIdea}>
          <label className="field">
            <span>Заголовок</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={140}
              required
            />
          </label>

          <label className="field">
            <span>Описание</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={3}
              maxLength={3000}
              rows={4}
              required
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Отправка...' : 'Отправить идею'}
            </button>
            {submitInfo ? <span className="form-info">{submitInfo}</span> : null}
          </div>

          {submitError ? <ErrorState message={submitError} /> : null}
        </form>
      </article>

      <div className="controls">
        {IDEAS_SORTS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={item.value === sort ? 'chip chip-active' : 'chip'}
            onClick={() => setSort(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && ideas.length === 0 ? <EmptyState message="Пока нет идей." /> : null}

      {!isLoading && !error && ideas.length > 0 ? (
        <div className="cards">
          {ideas.map((idea) => (
            <article key={idea.id} className="card">
              <header className="card-header">
                <h3>{idea.title}</h3>
                <span className="status">{IDEA_STATUS_LABEL[idea.status]}</span>
              </header>

              <p className="description">{idea.description}</p>
              <p className="meta">
                Голосов: <strong>{idea.votesCount}</strong> • Комментариев:{' '}
                <strong>{idea.commentsCount}</strong> • {formatDate(idea.createdAt)}
              </p>

              <button
                type="button"
                className="inline-button"
                onClick={() => setSelectedIdeaId(idea.id)}
              >
                Открыть детали
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {selectedIdeaId !== null ? (
        <div className="modal-backdrop" onClick={() => setSelectedIdeaId(null)}>
          <div className="modal-card modal-card-large" onClick={(event) => event.stopPropagation()}>
            <IdeaDetailsTab
              ideaId={selectedIdeaId}
              onBack={() => setSelectedIdeaId(null)}
              userFingerprint={userFingerprint}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};

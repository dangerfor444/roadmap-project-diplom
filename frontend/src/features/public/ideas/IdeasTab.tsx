import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ApiError, isAuthRequiredError, publicApi } from '../../../lib/api';
import type { IdeaSort, IdeaSummary } from '../../../types/public-api';
import { IDEAS_SORTS, IDEA_STATUS_LABEL, formatDate } from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';
import { IdeaDetailsTab } from './IdeaDetailsTab';

type IdeaViewMode = 'grid' | 'list';

const GridViewIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="view-switch-icon">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" />
    <rect x="9.5" y="1.5" width="5" height="5" rx="1.2" />
    <rect x="1.5" y="9.5" width="5" height="5" rx="1.2" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" />
  </svg>
);

const ListViewIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="view-switch-icon">
    <rect x="2" y="3" width="12" height="2" rx="1" />
    <rect x="2" y="7" width="12" height="2" rx="1" />
    <rect x="2" y="11" width="12" height="2" rx="1" />
  </svg>
);

const UI_TEXT = {
  title: 'Идеи',
  subtitle: 'Голосуйте, обсуждайте и предлагайте улучшения продукта.',
  openForm: 'Предложить идею',
  closeForm: 'Скрыть форму',
  formTitle: 'Новая идея',
  titleLabel: 'Заголовок',
  descriptionLabel: 'Описание',
  submit: 'Отправить идею',
  submitting: 'Отправка...',
  loadError: 'Не удалось загрузить идеи.',
  titleError: 'Заголовок должен быть от 3 до 140 символов.',
  descriptionError: 'Описание должно быть от 3 до 3000 символов.',
  submitSuccess: 'Идея отправлена.',
  submitError: 'Не удалось отправить идею.',
  tooManyRequests: 'Слишком много запросов.',
  retryAfterPrefix: ' Повторите через ',
  retryAfterSuffix: ' с.',
  empty: 'Пока нет идей.',
  openDetails: 'Открыть детали',
  votesLabel: 'Голосов',
  commentsLabel: 'Комментариев',
  authorLabel: 'Автор',
  gridView: 'Сетка',
  listView: 'Список',
} as const;

export const IdeasTab = ({ userFingerprint }: { userFingerprint: string }) => {
  const [sort, setSort] = useState<IdeaSort>('latest');
  const [viewMode, setViewMode] = useState<IdeaViewMode>('grid');
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [isIdeaFormOpen, setIsIdeaFormOpen] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);

  const loadIdeas = async (selectedSort: IdeaSort) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextIdeas = await publicApi.getIdeas(selectedSort);
      setIdeas(nextIdeas);
    } catch (requestError) {
      setError(errorMessage(requestError, UI_TEXT.loadError));
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
  }, [sort]);

  const toggleIdeaForm = () => {
    setIsIdeaFormOpen((current) => !current);
    setSubmitError(null);
    setSubmitInfo(null);
  };

  const openIdeaDetails = (ideaId: number) => {
    setSelectedIdeaId(ideaId);
  };

  const onSubmitIdea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitInfo(null);

    const safeTitle = title.trim();
    const safeDescription = description.trim();

    if (safeTitle.length < 3 || safeTitle.length > 140) {
      setSubmitError(UI_TEXT.titleError);
      return;
    }

    if (safeDescription.length < 3 || safeDescription.length > 3000) {
      setSubmitError(UI_TEXT.descriptionError);
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
      setSubmitInfo(UI_TEXT.submitSuccess);

      if (sort === 'latest') {
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
            ? `${UI_TEXT.retryAfterPrefix}${requestError.retryAfterSeconds}${UI_TEXT.retryAfterSuffix}`
            : '';
        setSubmitError(`${UI_TEXT.tooManyRequests}${retryHint}`);
      } else {
        setSubmitError(errorMessage(requestError, UI_TEXT.submitError));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tab-content">
      <div className="section-header">
        <div className="page-hero">
          <h2>{UI_TEXT.title}</h2>
          <p className="meta">{UI_TEXT.subtitle}</p>
        </div>
        <button type="button" className="primary-button" onClick={toggleIdeaForm}>
          {isIdeaFormOpen ? UI_TEXT.closeForm : UI_TEXT.openForm}
        </button>
      </div>

      {isIdeaFormOpen ? (
        <article className="card form-card form-card-collapsible">
          <h3>{UI_TEXT.formTitle}</h3>
          <form className="form-grid" onSubmit={onSubmitIdea}>
            <label className="field">
              <span>{UI_TEXT.titleLabel}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                maxLength={140}
                required
              />
            </label>

            <label className="field">
              <span>{UI_TEXT.descriptionLabel}</span>
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
                {isSubmitting ? UI_TEXT.submitting : UI_TEXT.submit}
              </button>
              {submitInfo ? <span className="form-info">{submitInfo}</span> : null}
            </div>

            {submitError ? <ErrorState message={submitError} /> : null}
          </form>
        </article>
      ) : null}

      <div className="ideas-toolbar">
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

        <div className="view-switcher" role="tablist" aria-label="Режим отображения идей">
          <button
            type="button"
            className={
              viewMode === 'grid'
                ? 'view-switch-button view-switch-button-active'
                : 'view-switch-button'
            }
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
          >
            <GridViewIcon />
            <span>{UI_TEXT.gridView}</span>
          </button>
          <button
            type="button"
            className={
              viewMode === 'list'
                ? 'view-switch-button view-switch-button-active'
                : 'view-switch-button'
            }
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
          >
            <ListViewIcon />
            <span>{UI_TEXT.listView}</span>
          </button>
        </div>
      </div>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && ideas.length === 0 ? <EmptyState message={UI_TEXT.empty} /> : null}

      {!isLoading && !error && ideas.length > 0 ? (
        <div className={viewMode === 'grid' ? 'idea-grid' : 'cards'}>
          {ideas.map((idea) => (
            <article
              key={idea.id}
              className={
                viewMode === 'grid'
                  ? 'card idea-card idea-card-compact idea-card-clickable'
                  : 'card idea-card idea-card-clickable'
              }
              role="button"
              tabIndex={0}
              onClick={() => openIdeaDetails(idea.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openIdeaDetails(idea.id);
                }
              }}
            >
              <header className="card-header">
                <h3>{idea.title}</h3>
                <span className="status">{IDEA_STATUS_LABEL[idea.status]}</span>
              </header>

              {viewMode === 'list' ? <p className="description">{idea.description}</p> : null}
              <p className="meta idea-card-author">
                {UI_TEXT.authorLabel}: <strong>{idea.authorName}</strong>
              </p>
              <p className="meta idea-card-meta">
                {UI_TEXT.votesLabel}: <strong>{idea.votesCount}</strong> • {UI_TEXT.commentsLabel}:{' '}
                <strong>{idea.commentsCount}</strong>
              </p>
              <p className="meta idea-card-date">{formatDate(idea.createdAt)}</p>

              <div className="idea-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openIdeaDetails(idea.id);
                  }}
                >
                  {UI_TEXT.openDetails}
                </button>
              </div>
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

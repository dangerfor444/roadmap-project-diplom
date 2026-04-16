import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { managerApi } from '../../lib/manager-api';
import type {
  ManagerCommentItem,
  ManagerRoadmapDetails,
  ManagerRoadmapItem,
} from '../../types/manager-api';
import type { RoadmapStatus } from '../../types/public-api';
import { ROADMAP_STATUS_LABEL, ROADMAP_STATUS_OPTIONS, formatDate } from '../common/meta';
import { EmptyState, ErrorState, LoadingState } from '../common/ui';
import { managerErrorMessage } from './error';

type ManagerRoadmapEditor = {
  title: string;
  description: string;
  status: RoadmapStatus;
  category: string;
};

const ROADMAP_COLUMNS: RoadmapStatus[] = ['planned', 'in_progress', 'done'];

const getQuarterNumber = (date: Date): number => Math.floor(date.getMonth() / 3) + 1;
const getQuarterKey = (date: Date): string => `${date.getFullYear()}-Q${getQuarterNumber(date)}`;
const getQuarterKeyFromIso = (isoDate: string): string => getQuarterKey(new Date(isoDate));
const getCurrentQuarterKey = (): string => getQuarterKey(new Date());
const getQuarterIndex = (year: number, quarter: number): number => year * 4 + (quarter - 1);

const parseQuarterKey = (quarterKey: string): { year: number; quarter: number } => {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarterKey);
  return {
    year: match ? Number(match[1]) : 0,
    quarter: match ? Number(match[2]) : 0,
  };
};

const createQuarterKey = (year: number, quarter: number): string => `${year}-Q${quarter}`;

const buildQuarterTimeline = (items: ManagerRoadmapItem[], currentQuarterKey: string): string[] => {
  const quarterEntries = [currentQuarterKey, ...items.map((item) => getQuarterKeyFromIso(item.createdAt))].map(
    parseQuarterKey
  );

  const minIndex = Math.min(...quarterEntries.map((entry) => getQuarterIndex(entry.year, entry.quarter)));
  const maxIndex = Math.max(...quarterEntries.map((entry) => getQuarterIndex(entry.year, entry.quarter)));

  return Array.from({ length: maxIndex - minIndex + 1 }, (_, offset) => {
    const index = minIndex + offset;
    const year = Math.floor(index / 4);
    const quarter = (index % 4) + 1;
    return createQuarterKey(year, quarter);
  });
};

const formatQuarterLabel = (quarterKey: string): string => {
  const { year, quarter } = parseQuarterKey(quarterKey);
  const startMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
  const endMonth = String(quarter * 3).padStart(2, '0');
  return `${quarter} кв. ${startMonth} - ${endMonth}.${year}`;
};

const UI_TEXT = {
  pageTitle: 'Управление: roadmap',
  pageSubtitle: 'Создание, редактирование, скрытие и удаление элементов roadmap.',
  openCreateForm: 'Добавить элемент',
  closeCreateForm: 'Скрыть форму',
  createTitle: 'Новый элемент roadmap',
  editTitle: 'Редактирование элемента roadmap',
  titleLabel: 'Заголовок',
  descriptionLabel: 'Описание',
  statusLabel: 'Статус',
  categoryCreateLabel: 'Категория (необязательно)',
  categoryLabel: 'Категория',
  createButton: 'Создать элемент roadmap',
  creatingButton: 'Создание...',
  titleError: 'Заголовок roadmap должен быть от 3 до 120 символов.',
  descriptionError: 'Описание roadmap должно быть от 3 до 2000 символов.',
  categoryError: 'Категория roadmap должна быть не длиннее 80 символов.',
  loadError: 'Не удалось загрузить roadmap в панели управления.',
  loadDetailsError: 'Не удалось загрузить детали элемента roadmap.',
  createError: 'Не удалось создать элемент roadmap.',
  createSuccess: 'Элемент roadmap #{id} создан.',
  updateError: 'Не удалось обновить элемент roadmap.',
  updateSuccess: 'Элемент roadmap #{id} обновлён.',
  deleteError: 'Не удалось удалить элемент roadmap.',
  deleteSuccess: 'Элемент roadmap #{id} удалён.',
  visibilityError: 'Не удалось изменить видимость элемента roadmap.',
  visibilitySuccess: 'Видимость элемента roadmap #{id} обновлена.',
  commentVisibilityError: 'Не удалось изменить видимость комментария.',
  commentVisibilitySuccess: 'Видимость комментария #{id} обновлена.',
  deleteCommentError: 'Не удалось удалить комментарий.',
  deleteCommentSuccess: 'Комментарий #{id} удалён.',
  empty: 'Элементов roadmap пока нет.',
  emptyQuarter: 'В выбранном квартале пока нет элементов roadmap.',
  emptyColumn: 'В этой колонке пока пусто.',
  noComments: 'Комментариев к этому элементу пока нет.',
  commentsTitle: 'Комментарии',
  authorLabel: 'Автор',
  idPrefix: 'ID',
  hiddenBadge: 'Скрыт',
  hiddenLabel: 'Скрыт',
  votesLabel: 'Лайков',
  commentsLabel: 'Комментариев',
  createdAtLabel: 'Создано',
  saveButton: 'Сохранить',
  savingButton: 'Сохранение...',
  hideButton: 'Скрыть',
  showButton: 'Показать',
  deleteButton: 'Удалить',
  closeButton: 'Закрыть',
  deleteCommentButton: 'Удалить комментарий',
  clickHint: 'Нажмите, чтобы редактировать',
  deleteConfirm: 'Удалить элемент roadmap #{id} без возможности восстановления?',
  deleteCommentConfirm: 'Удалить комментарий #{id} без возможности восстановления?',
  noCategory: 'Без категории',
} as const;

const toManagerRoadmapEditor = (item: ManagerRoadmapItem): ManagerRoadmapEditor => ({
  title: item.title,
  description: item.description,
  status: item.status,
  category: item.category ?? '',
});

const getCategoryLabel = (category: string | null) => category?.trim() || UI_TEXT.noCategory;

export const ManagerRoadmapPage = () => {
  const currentQuarterKey = useMemo(() => getCurrentQuarterKey(), []);
  const [items, setItems] = useState<ManagerRoadmapItem[]>([]);
  const [editors, setEditors] = useState<Record<number, ManagerRoadmapEditor>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [busyCommentKey, setBusyCommentKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<ManagerRoadmapDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string>(currentQuarterKey);

  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createStatus, setCreateStatus] = useState<RoadmapStatus>('planned');
  const [createCategory, setCreateCategory] = useState('');

  const loadRoadmap = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await managerApi.getRoadmap();
      setItems(data);
      setEditors(
        data.reduce<Record<number, ManagerRoadmapEditor>>((acc, item) => {
          acc[item.id] = toManagerRoadmapEditor(item);
          return acc;
        }, {})
      );
    } catch (requestError) {
      setError(managerErrorMessage(requestError, UI_TEXT.loadError));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoadmapDetails = async (itemId: number) => {
    setIsDetailsLoading(true);
    setDetailsError(null);

    try {
      const details = await managerApi.getRoadmapDetails(itemId);
      setSelectedDetails(details);
      setEditors((current) => ({
        ...current,
        [itemId]: current[itemId] ?? toManagerRoadmapEditor(details),
      }));
    } catch (requestError) {
      setDetailsError(managerErrorMessage(requestError, UI_TEXT.loadDetailsError));
    } finally {
      setIsDetailsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoadmap();
  }, []);

  useEffect(() => {
    if (selectedItemId === null) {
      setSelectedDetails(null);
      setDetailsError(null);
      return;
    }

    void loadRoadmapDetails(selectedItemId);
  }, [selectedItemId]);

  useEffect(() => {
    if (selectedItemId === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItemId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedItemId]);

  const quarterTimeline = useMemo(() => buildQuarterTimeline(items, currentQuarterKey), [currentQuarterKey, items]);

  const selectedQuarterIndex = useMemo(
    () => quarterTimeline.indexOf(selectedQuarter),
    [quarterTimeline, selectedQuarter]
  );

  const filteredItems = useMemo(
    () => items.filter((item) => getQuarterKeyFromIso(item.createdAt) === selectedQuarter),
    [items, selectedQuarter]
  );

  const itemsByStatus = useMemo(
    () =>
      ROADMAP_COLUMNS.reduce<Record<RoadmapStatus, ManagerRoadmapItem[]>>(
        (accumulator, status) => {
          accumulator[status] = filteredItems.filter((item) => item.status === status);
          return accumulator;
        },
        { planned: [], in_progress: [], done: [] }
      ),
    [filteredItems]
  );

  const selectedItem =
    selectedItemId !== null ? items.find((item) => item.id === selectedItemId) ?? null : null;
  const selectedEditor =
    selectedItem !== null ? editors[selectedItem.id] ?? toManagerRoadmapEditor(selectedItem) : null;

  const onEditorChange = <K extends keyof ManagerRoadmapEditor>(
    itemId: number,
    key: K,
    value: ManagerRoadmapEditor[K]
  ) => {
    setEditors((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? {
          title: '',
          description: '',
          status: 'planned',
          category: '',
        }),
        [key]: value,
      },
    }));
  };

  const validateRoadmapDraft = (draft: ManagerRoadmapEditor) => {
    const title = draft.title.trim();
    const description = draft.description.trim();
    const category = draft.category.trim();

    if (title.length < 3 || title.length > 120) {
      return UI_TEXT.titleError;
    }
    if (description.length < 3 || description.length > 2000) {
      return UI_TEXT.descriptionError;
    }
    if (category.length > 80) {
      return UI_TEXT.categoryError;
    }

    return null;
  };

  const onCreateRoadmapItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setInfo(null);

    const draft: ManagerRoadmapEditor = {
      title: createTitle,
      description: createDescription,
      status: createStatus,
      category: createCategory,
    };

    const validationError = validateRoadmapDraft(draft);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setIsCreating(true);
    try {
      const created = await managerApi.createRoadmap({
        title: draft.title.trim(),
        description: draft.description.trim(),
        status: draft.status,
        category: draft.category.trim() || null,
      });

      setItems((current) => [created, ...current]);
      setEditors((current) => ({
        ...current,
        [created.id]: toManagerRoadmapEditor(created),
      }));
      setCreateTitle('');
      setCreateDescription('');
      setCreateStatus('planned');
      setCreateCategory('');
      setIsCreateFormOpen(false);
      setInfo(UI_TEXT.createSuccess.replace('{id}', String(created.id)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.createError));
    } finally {
      setIsCreating(false);
    }
  };

  const onSaveRoadmapItem = async (itemId: number) => {
    const draft = editors[itemId];
    if (!draft) {
      return;
    }

    setActionError(null);
    setInfo(null);

    const validationError = validateRoadmapDraft(draft);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setBusyItemId(itemId);
    try {
      const updated = await managerApi.updateRoadmap(itemId, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        status: draft.status,
        category: draft.category.trim() || null,
      });

      setItems((current) => current.map((item) => (item.id === itemId ? updated : item)));
      setEditors((current) => ({
        ...current,
        [itemId]: toManagerRoadmapEditor(updated),
      }));
      setSelectedDetails((current) =>
        current && current.id === itemId ? { ...current, ...updated } : current
      );
      setInfo(UI_TEXT.updateSuccess.replace('{id}', String(itemId)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.updateError));
    } finally {
      setBusyItemId(null);
    }
  };

  const onToggleVisibility = async (itemId: number, isHidden: boolean) => {
    setActionError(null);
    setInfo(null);
    setBusyItemId(itemId);

    try {
      const updated = await managerApi.updateRoadmapVisibility(itemId, !isHidden);
      setItems((current) => current.map((item) => (item.id === itemId ? updated : item)));
      setEditors((current) => ({
        ...current,
        [itemId]: toManagerRoadmapEditor(updated),
      }));
      setSelectedDetails((current) =>
        current && current.id === itemId ? { ...current, ...updated } : current
      );
      setInfo(UI_TEXT.visibilitySuccess.replace('{id}', String(itemId)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.visibilityError));
    } finally {
      setBusyItemId(null);
    }
  };

  const onDeleteRoadmapItem = async (itemId: number) => {
    if (!window.confirm(UI_TEXT.deleteConfirm.replace('{id}', String(itemId)))) {
      return;
    }

    setActionError(null);
    setInfo(null);
    setBusyItemId(itemId);

    try {
      await managerApi.deleteRoadmap(itemId);
      setItems((current) => current.filter((item) => item.id !== itemId));
      setEditors((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }
      setInfo(UI_TEXT.deleteSuccess.replace('{id}', String(itemId)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.deleteError));
    } finally {
      setBusyItemId(null);
    }
  };

  const refreshSelectedDetails = async (itemId: number) => {
    const details = await managerApi.getRoadmapDetails(itemId);
    setSelectedDetails(details);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              commentsCount: details.commentsCount,
              votesCount: details.votesCount,
              isHidden: details.isHidden,
              title: details.title,
              description: details.description,
              status: details.status,
              category: details.category,
              updatedAt: details.updatedAt,
            }
          : item
      )
    );
  };

  const onModerateComment = async (comment: ManagerCommentItem, isHidden: boolean) => {
    if (!selectedItem) {
      return;
    }

    const commentKey = `${comment.target}:${comment.id}`;
    setActionError(null);
    setInfo(null);
    setBusyCommentKey(commentKey);

    try {
      await managerApi.moderateComment(comment.target, comment.id, isHidden);
      await refreshSelectedDetails(selectedItem.id);
      setInfo(UI_TEXT.commentVisibilitySuccess.replace('{id}', String(comment.id)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.commentVisibilityError));
    } finally {
      setBusyCommentKey(null);
    }
  };

  const onDeleteComment = async (comment: ManagerCommentItem) => {
    if (!selectedItem) {
      return;
    }
    if (!window.confirm(UI_TEXT.deleteCommentConfirm.replace('{id}', String(comment.id)))) {
      return;
    }

    const commentKey = `${comment.target}:${comment.id}`;
    setActionError(null);
    setInfo(null);
    setBusyCommentKey(commentKey);

    try {
      await managerApi.deleteComment(comment.target, comment.id);
      await refreshSelectedDetails(selectedItem.id);
      setInfo(UI_TEXT.deleteCommentSuccess.replace('{id}', String(comment.id)));
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, UI_TEXT.deleteCommentError));
    } finally {
      setBusyCommentKey(null);
    }
  };

  return (
    <section className="tab-content">
      <div className="section-header">
        <div>
          <h2>{UI_TEXT.pageTitle}</h2>
          <p className="meta">{UI_TEXT.pageSubtitle}</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setIsCreateFormOpen((current) => !current)}
        >
          {isCreateFormOpen ? UI_TEXT.closeCreateForm : UI_TEXT.openCreateForm}
        </button>
      </div>

      <div className="roadmap-quarter-filter">
        <div className="roadmap-quarter-nav">
          <button
            type="button"
            className="roadmap-quarter-nav-button"
            onClick={() => {
              if (selectedQuarterIndex > 0) {
                setSelectedQuarter(quarterTimeline[selectedQuarterIndex - 1]);
              }
            }}
            disabled={selectedQuarterIndex <= 0}
            aria-label="Предыдущий квартал"
          >
            <svg className="roadmap-quarter-chevron" viewBox="0 0 12 20" aria-hidden="true">
              <path d="M10 2 2 10l8 8" />
            </svg>
          </button>
          <div className="roadmap-quarter-current">{formatQuarterLabel(selectedQuarter)}</div>
          <button
            type="button"
            className="roadmap-quarter-nav-button"
            onClick={() => {
              if (selectedQuarterIndex < quarterTimeline.length - 1) {
                setSelectedQuarter(quarterTimeline[selectedQuarterIndex + 1]);
              }
            }}
            disabled={selectedQuarterIndex === -1 || selectedQuarterIndex >= quarterTimeline.length - 1}
            aria-label="Следующий квартал"
          >
            <svg className="roadmap-quarter-chevron" viewBox="0 0 12 20" aria-hidden="true">
              <path d="M2 2l8 8-8 8" />
            </svg>
          </button>
        </div>
      </div>

      {isCreateFormOpen ? (
        <article className="card form-card form-card-collapsible">
          <h3>{UI_TEXT.createTitle}</h3>
          <form className="form-grid" onSubmit={onCreateRoadmapItem}>
            <label className="field">
              <span>{UI_TEXT.titleLabel}</span>
              <input
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                minLength={3}
                maxLength={120}
                required
              />
            </label>

            <label className="field">
              <span>{UI_TEXT.descriptionLabel}</span>
              <textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                minLength={3}
                maxLength={2000}
                rows={4}
                required
              />
            </label>

            <div className="manager-toolbar">
              <label className="field manager-inline-field">
                <span>{UI_TEXT.statusLabel}</span>
                <select
                  value={createStatus}
                  onChange={(event) => setCreateStatus(event.target.value as RoadmapStatus)}
                >
                  {ROADMAP_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field manager-inline-field">
                <span>{UI_TEXT.categoryCreateLabel}</span>
                <input
                  value={createCategory}
                  onChange={(event) => setCreateCategory(event.target.value)}
                  maxLength={80}
                />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={isCreating}>
                {isCreating ? UI_TEXT.creatingButton : UI_TEXT.createButton}
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {actionError ? <ErrorState message={actionError} /> : null}
      {info ? <p className="form-info">{info}</p> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState message={UI_TEXT.empty} /> : null}
      {!isLoading && !error && items.length > 0 && filteredItems.length === 0 ? (
        <EmptyState message={UI_TEXT.emptyQuarter} />
      ) : null}

      {!isLoading && !error && items.length > 0 && filteredItems.length > 0 ? (
        <div className="roadmap-board manager-roadmap-board">
          {ROADMAP_COLUMNS.map((status) => {
            const columnItems = itemsByStatus[status];

            return (
              <section key={status} className={`roadmap-column roadmap-column-${status}`}>
                <header className="roadmap-column-header">
                  <h3>{ROADMAP_STATUS_LABEL[status]}</h3>
                  <span className="roadmap-column-count">{columnItems.length}</span>
                </header>

                {columnItems.length === 0 ? (
                  <div className="roadmap-column-empty">{UI_TEXT.emptyColumn}</div>
                ) : (
                  <div className="roadmap-column-cards">
                    {columnItems.map((item) => (
                      <article
                        key={item.id}
                        className="card roadmap-card roadmap-card-clickable manager-roadmap-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedItemId(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedItemId(item.id);
                          }
                        }}
                      >
                        <div className="manager-roadmap-card-top">
                          <span className="roadmap-category">{getCategoryLabel(item.category)}</span>
                          {item.isHidden ? (
                            <span className="status status-hidden">{UI_TEXT.hiddenBadge}</span>
                          ) : null}
                        </div>

                        <h4>{item.title}</h4>
                        <p className="meta">
                          {UI_TEXT.idPrefix}: <strong>{item.id}</strong>
                        </p>
                        <p className="meta roadmap-card-meta">
                          {UI_TEXT.votesLabel}: <strong>{item.votesCount}</strong>
                          {' • '}
                          {UI_TEXT.commentsLabel}: <strong>{item.commentsCount}</strong>
                        </p>
                        <p className="meta roadmap-card-date">
                          {UI_TEXT.createdAtLabel}: {formatDate(item.createdAt)}
                        </p>
                        <p className="manager-roadmap-card-hint">{UI_TEXT.clickHint}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {selectedItem && selectedEditor ? (
        <div className="modal-backdrop" onClick={() => setSelectedItemId(null)}>
          <div className="modal-card modal-card-large" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="auth-title">{UI_TEXT.editTitle}</h3>
                <p className="meta">
                  {UI_TEXT.idPrefix}: <strong>{selectedItem.id}</strong>
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedItemId(null)}
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
                  <div className="manager-roadmap-modal-top">
                    <span className="roadmap-category">
                      {getCategoryLabel(selectedEditor.category || selectedItem.category)}
                    </span>
                    {(selectedDetails?.isHidden ?? selectedItem.isHidden) ? (
                      <span className="status status-hidden">{UI_TEXT.hiddenBadge}</span>
                    ) : null}
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>{UI_TEXT.titleLabel}</span>
                      <input
                        value={selectedEditor.title}
                        onChange={(event) =>
                          onEditorChange(selectedItem.id, 'title', event.target.value)
                        }
                        minLength={3}
                        maxLength={120}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>{UI_TEXT.descriptionLabel}</span>
                      <textarea
                        value={selectedEditor.description}
                        onChange={(event) =>
                          onEditorChange(selectedItem.id, 'description', event.target.value)
                        }
                        minLength={3}
                        maxLength={2000}
                        rows={6}
                        required
                      />
                    </label>

                    <div className="manager-toolbar">
                      <label className="field manager-inline-field">
                        <span>{UI_TEXT.statusLabel}</span>
                        <select
                          value={selectedEditor.status}
                          onChange={(event) =>
                            onEditorChange(
                              selectedItem.id,
                              'status',
                              event.target.value as RoadmapStatus
                            )
                          }
                        >
                          {ROADMAP_STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption.value} value={statusOption.value}>
                              {statusOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field manager-inline-field">
                        <span>{UI_TEXT.categoryLabel}</span>
                        <input
                          value={selectedEditor.category}
                          onChange={(event) =>
                            onEditorChange(selectedItem.id, 'category', event.target.value)
                          }
                          maxLength={80}
                        />
                      </label>
                    </div>

                    <p className="meta">
                      {UI_TEXT.votesLabel}: <strong>{selectedDetails?.votesCount ?? selectedItem.votesCount}</strong>
                      {' • '}
                      {UI_TEXT.commentsLabel}:{' '}
                      <strong>{selectedDetails?.commentsCount ?? selectedItem.commentsCount}</strong>
                      {' • '}
                      {UI_TEXT.createdAtLabel}: {formatDate(selectedItem.createdAt)}
                    </p>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => onSaveRoadmapItem(selectedItem.id)}
                        disabled={busyItemId === selectedItem.id}
                      >
                        {busyItemId === selectedItem.id ? UI_TEXT.savingButton : UI_TEXT.saveButton}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          onToggleVisibility(
                            selectedItem.id,
                            selectedDetails?.isHidden ?? selectedItem.isHidden
                          )
                        }
                        disabled={busyItemId === selectedItem.id}
                      >
                        {(selectedDetails?.isHidden ?? selectedItem.isHidden)
                          ? UI_TEXT.showButton
                          : UI_TEXT.hideButton}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => onDeleteRoadmapItem(selectedItem.id)}
                        disabled={busyItemId === selectedItem.id}
                      >
                        {UI_TEXT.deleteButton}
                      </button>
                    </div>
                  </div>
                </article>

                <section className="manager-inline-comments">
                  <div className="section-header manager-inline-comments-header">
                    <div>
                      <h3>{UI_TEXT.commentsTitle}</h3>
                      <p className="meta">
                        {UI_TEXT.commentsLabel}:{' '}
                        <strong>{selectedDetails?.comments.length ?? 0}</strong>
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



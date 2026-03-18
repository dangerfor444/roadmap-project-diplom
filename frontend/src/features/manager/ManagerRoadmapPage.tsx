import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { managerApi } from '../../lib/manager-api';
import type { ManagerRoadmapItem } from '../../types/manager-api';
import type { RoadmapStatus } from '../../types/public-api';
import { ROADMAP_STATUS_OPTIONS, formatDate } from '../common/meta';
import { EmptyState, ErrorState, LoadingState } from '../common/ui';
import { managerErrorMessage } from './error';

type ManagerRoadmapEditor = {
  title: string;
  description: string;
  status: RoadmapStatus;
  category: string;
};

const toManagerRoadmapEditor = (item: ManagerRoadmapItem): ManagerRoadmapEditor => ({
  title: item.title,
  description: item.description,
  status: item.status,
  category: item.category ?? '',
});

export const ManagerRoadmapPage = () => {
  const [items, setItems] = useState<ManagerRoadmapItem[]>([]);
  const [editors, setEditors] = useState<Record<number, ManagerRoadmapEditor>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [createTitle, setCreateTitle] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createStatus, setCreateStatus] = useState<RoadmapStatus>('planned');
  const [createCategory, setCreateCategory] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await managerApi.getRoadmap();
        if (!isCancelled) {
          setItems(data);
          setEditors(
            data.reduce<Record<number, ManagerRoadmapEditor>>((acc, item) => {
              acc[item.id] = toManagerRoadmapEditor(item);
              return acc;
            }, {})
          );
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(managerErrorMessage(requestError, 'Не удалось загрузить roadmap в панели управления.'));
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
  }, []);

  const onCreateRoadmapItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setInfo(null);

    const title = createTitle.trim();
    const description = createDescription.trim();
    const category = createCategory.trim();

    if (title.length < 3 || title.length > 120) {
      setActionError('Заголовок roadmap должен быть от 3 до 120 символов.');
      return;
    }
    if (description.length < 3 || description.length > 2000) {
      setActionError('Описание roadmap должно быть от 3 до 2000 символов.');
      return;
    }
    if (category.length > 80) {
      setActionError('Категория roadmap должна быть не длиннее 80 символов.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await managerApi.createRoadmap({
        title,
        description,
        status: createStatus,
        category: category || null,
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
      setInfo(`Элемент roadmap #${created.id} создан.`);
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, 'Не удалось создать элемент roadmap.'));
    } finally {
      setIsCreating(false);
    }
  };

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

  const onSaveRoadmapItem = async (itemId: number) => {
    const draft = editors[itemId];
    if (!draft) return;

    setActionError(null);
    setInfo(null);

    const title = draft.title.trim();
    const description = draft.description.trim();
    const category = draft.category.trim();

    if (title.length < 3 || title.length > 120) {
      setActionError('Заголовок roadmap должен быть от 3 до 120 символов.');
      return;
    }
    if (description.length < 3 || description.length > 2000) {
      setActionError('Описание roadmap должно быть от 3 до 2000 символов.');
      return;
    }
    if (category.length > 80) {
      setActionError('Категория roadmap должна быть не длиннее 80 символов.');
      return;
    }

    setBusyItemId(itemId);
    try {
      const updated = await managerApi.updateRoadmap(itemId, {
        title,
        description,
        status: draft.status,
        category: category || null,
      });
      setItems((current) => current.map((item) => (item.id === itemId ? updated : item)));
      setEditors((current) => ({
        ...current,
        [itemId]: toManagerRoadmapEditor(updated),
      }));
      setInfo(`Элемент roadmap #${itemId} обновлен.`);
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, 'Не удалось обновить элемент roadmap.'));
    } finally {
      setBusyItemId(null);
    }
  };

  const onDeleteRoadmapItem = async (itemId: number) => {
    if (!window.confirm(`Удалить элемент roadmap #${itemId}?`)) return;

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
      setInfo(`Элемент roadmap #${itemId} удален.`);
    } catch (requestError) {
      setActionError(managerErrorMessage(requestError, 'Не удалось удалить элемент roadmap.'));
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <section className="tab-content">
      <h2>Управление: roadmap</h2>
      <p className="meta">
        Создание, редактирование, смена статуса и удаление элементов roadmap.
      </p>

      <article className="card form-card">
        <h3>Создать элемент roadmap</h3>
        <form className="form-grid" onSubmit={onCreateRoadmapItem}>
          <label className="field">
            <span>Заголовок</span>
            <input
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              minLength={3}
              maxLength={120}
              required
            />
          </label>

          <label className="field">
            <span>Описание</span>
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
              <span>Статус</span>
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
              <span>Категория (необязательно)</span>
              <input
                value={createCategory}
                onChange={(event) => setCreateCategory(event.target.value)}
                maxLength={80}
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isCreating}>
              {isCreating ? 'Создание...' : 'Создать элемент roadmap'}
            </button>
          </div>
        </form>
      </article>

      {actionError ? <ErrorState message={actionError} /> : null}
      {info ? <p className="form-info">{info}</p> : null}
      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && items.length === 0 ? (
        <EmptyState message="Элементов roadmap пока нет." />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="cards">
          {items.map((item) => {
            const editor = editors[item.id] ?? toManagerRoadmapEditor(item);
            const isBusy = busyItemId === item.id;

            return (
              <article key={item.id} className="card">
                <p className="meta">ID: {item.id}</p>
                <div className="form-grid">
                  <label className="field">
                    <span>Заголовок</span>
                    <input
                      value={editor.title}
                      onChange={(event) => onEditorChange(item.id, 'title', event.target.value)}
                      minLength={3}
                      maxLength={120}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Описание</span>
                    <textarea
                      value={editor.description}
                      onChange={(event) =>
                        onEditorChange(item.id, 'description', event.target.value)
                      }
                      minLength={3}
                      maxLength={2000}
                      rows={4}
                      required
                    />
                  </label>

                  <div className="manager-toolbar">
                    <label className="field manager-inline-field">
                      <span>Статус</span>
                      <select
                        value={editor.status}
                        onChange={(event) =>
                          onEditorChange(item.id, 'status', event.target.value as RoadmapStatus)
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
                      <span>Категория</span>
                      <input
                        value={editor.category}
                        onChange={(event) => onEditorChange(item.id, 'category', event.target.value)}
                        maxLength={80}
                      />
                    </label>
                  </div>

                  <p className="meta">
                    Голоса: <strong>{item.votesCount}</strong> • Комментарии:{' '}
                    <strong>{item.commentsCount}</strong> • Создано: {formatDate(item.createdAt)}
                  </p>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onSaveRoadmapItem(item.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => onDeleteRoadmapItem(item.id)}
                      disabled={isBusy}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

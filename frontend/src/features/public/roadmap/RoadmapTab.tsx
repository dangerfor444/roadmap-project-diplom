import { useEffect, useMemo, useState } from 'react';
import { publicApi } from '../../../lib/api';
import type { RoadmapItem, RoadmapStatus } from '../../../types/public-api';
import { ROADMAP_STATUS_LABEL, formatDate } from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';
import { RoadmapDetailsTab } from './RoadmapDetailsTab';

const ROADMAP_COLUMNS: RoadmapStatus[] = ['planned', 'in_progress', 'done'];

const UI_TEXT = {
  title: 'Roadmap',
  subtitle: 'Публичный roadmap продукта: что запланировано, что уже в работе и что реализовано.',
  uncategorized: 'Без категории',
  votes: 'Лайков',
  comments: 'Комментариев',
  openDiscussion: 'Открыть обсуждение',
  loadError: 'Не удалось загрузить roadmap.',
  emptyBoard: 'Пока нет элементов roadmap.',
  emptyColumn: 'В этой колонке пока пусто.',
} as const;

const getCategoryLabel = (category: string | null): string => category?.trim() || UI_TEXT.uncategorized;

export const RoadmapTab = ({ userFingerprint }: { userFingerprint: string }) => {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<number | null>(null);

  const openRoadmapDetails = (roadmapItemId: number) => {
    setSelectedRoadmapId(roadmapItemId);
  };

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextItems = await publicApi.getRoadmap('all');
        if (!isCancelled) {
          setItems(nextItems);
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
  }, []);

  const itemsByStatus = useMemo(
    () =>
      ROADMAP_COLUMNS.reduce<Record<RoadmapStatus, RoadmapItem[]>>((accumulator, status) => {
        accumulator[status] = items.filter((item) => item.status === status);
        return accumulator;
      }, { planned: [], in_progress: [], done: [] }),
    [items]
  );

  return (
    <section className="tab-content">
      <div className="roadmap-hero">
        <h2>{UI_TEXT.title}</h2>
        <p className="meta">{UI_TEXT.subtitle}</p>
      </div>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState message={UI_TEXT.emptyBoard} /> : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="roadmap-board">
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
                        className="card roadmap-card roadmap-card-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => openRoadmapDetails(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openRoadmapDetails(item.id);
                          }
                        }}
                      >
                        <div className="roadmap-card-top">
                          <span className="roadmap-category">{getCategoryLabel(item.category)}</span>
                        </div>

                        <h4>{item.title}</h4>
                        <p className="meta roadmap-card-meta">
                          {UI_TEXT.votes}: <strong>{item.votesCount}</strong> • {UI_TEXT.comments}:{' '}
                          <strong>{item.commentsCount}</strong>
                        </p>
                        <p className="meta roadmap-card-date">{formatDate(item.createdAt)}</p>

                        <button
                          type="button"
                          className="secondary-button roadmap-card-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            openRoadmapDetails(item.id);
                          }}
                        >
                          {UI_TEXT.openDiscussion}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {selectedRoadmapId !== null ? (
        <div className="modal-backdrop" onClick={() => setSelectedRoadmapId(null)}>
          <div className="modal-card modal-card-large" onClick={(event) => event.stopPropagation()}>
            <RoadmapDetailsTab
              roadmapItemId={selectedRoadmapId}
              onBack={() => setSelectedRoadmapId(null)}
              userFingerprint={userFingerprint}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};

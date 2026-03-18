import { useEffect, useState } from 'react';
import { publicApi } from '../../../lib/api';
import type { RoadmapItem } from '../../../types/public-api';
import {
  ROADMAP_FILTERS,
  ROADMAP_STATUS_LABEL,
  type RoadmapFilter,
  formatDate,
} from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';
import { RoadmapDetailsTab } from './RoadmapDetailsTab';

export const RoadmapTab = ({ userFingerprint }: { userFingerprint: string }) => {
  const [status, setStatus] = useState<RoadmapFilter>('all');
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextItems = await publicApi.getRoadmap(status);
        if (!isCancelled) {
          setItems(nextItems);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(errorMessage(requestError, 'Не удалось загрузить дорожную карту.'));
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
  }, [status]);

  return (
    <section className="tab-content">
      <h2>Дорожная карта</h2>
      <div className="controls">
        {ROADMAP_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={filter.value === status ? 'chip chip-active' : 'chip'}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && items.length === 0 ? (
        <EmptyState message="Пока нет элементов дорожной карты." />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="cards">
          {items.map((item) => (
            <article key={item.id} className="card">
              <header className="card-header">
                <h3>{item.title}</h3>
                <span className="status">{ROADMAP_STATUS_LABEL[item.status]}</span>
              </header>

              <p className="description">{item.description}</p>
              <p className="meta">
                {item.category ? `Категория: ${item.category}` : 'Без категории'} • Голосов:{' '}
                <strong>{item.votesCount}</strong> • Комментариев: <strong>{item.commentsCount}</strong>{' '}
                • {formatDate(item.createdAt)}
              </p>

              <button
                type="button"
                className="inline-button"
                onClick={() => setSelectedRoadmapId(item.id)}
              >
                Открыть обсуждение
              </button>
            </article>
          ))}
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

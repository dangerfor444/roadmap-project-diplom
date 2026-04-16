import { useEffect, useMemo, useState } from 'react';
import { publicApi } from '../../../lib/api';
import { getWriteStorageIdentity } from '../../../lib/write-auth';
import type { RoadmapItem, RoadmapStatus } from '../../../types/public-api';
import { ROADMAP_STATUS_LABEL, formatDate } from '../../common/meta';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '../../common/ui';
import { RoadmapDetailsTab } from './RoadmapDetailsTab';

const ROADMAP_COLUMNS: RoadmapStatus[] = ['planned', 'in_progress', 'done'];

const UI_TEXT = {
  title: 'Roadmap',
  subtitle: 'Публичный roadmap продукта: что запланировано, что уже в работе и что реализовано.',
  uncategorized: 'Без категории',
  comments: 'Комментариев',
  openDiscussion: 'Открыть обсуждение',
  loadError: 'Не удалось загрузить roadmap.',
  emptyBoard: 'Пока нет элементов roadmap.',
  emptyQuarter: 'В выбранном квартале пока нет задач roadmap.',
  emptyColumn: 'В этой колонке пока пусто.',
} as const;

const getCategoryLabel = (category: string | null): string => category?.trim() || UI_TEXT.uncategorized;
const getRoadmapVotedKey = (roadmapItemId: number, userFingerprint: string) =>
  `roadmap:item:voted:${roadmapItemId}:${getWriteStorageIdentity(userFingerprint)}`;

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

const buildQuarterTimeline = (items: RoadmapItem[], currentQuarterKey: string): string[] => {
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

const buildVotedRoadmapMap = (items: RoadmapItem[], userFingerprint: string): Record<number, boolean> =>
  Object.fromEntries(
    items.map((item) => [item.id, localStorage.getItem(getRoadmapVotedKey(item.id, userFingerprint)) === '1'])
  );

export const RoadmapTab = ({ userFingerprint }: { userFingerprint: string }) => {
  const currentQuarterKey = useMemo(() => getCurrentQuarterKey(), []);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<number | null>(null);
  const [votedItems, setVotedItems] = useState<Record<number, boolean>>({});
  const [selectedQuarter, setSelectedQuarter] = useState<string>(currentQuarterKey);

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
          setVotedItems(buildVotedRoadmapMap(nextItems, userFingerprint));
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
  }, [userFingerprint]);

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
      ROADMAP_COLUMNS.reduce<Record<RoadmapStatus, RoadmapItem[]>>((accumulator, status) => {
        accumulator[status] = filteredItems.filter((item) => item.status === status);
        return accumulator;
      }, { planned: [], in_progress: [], done: [] }),
    [filteredItems]
  );

  const onRoadmapItemChange = ({
    roadmapItemId,
    votesCount,
    commentsCount,
    voted,
  }: {
    roadmapItemId: number;
    votesCount?: number;
    commentsCount?: number;
    voted?: boolean;
  }) => {
    setItems((current) =>
      current.map((item) =>
        item.id === roadmapItemId
          ? {
              ...item,
              votesCount: votesCount ?? item.votesCount,
              commentsCount: commentsCount ?? item.commentsCount,
            }
          : item
      )
    );

    if (typeof voted === 'boolean') {
      setVotedItems((current) => ({ ...current, [roadmapItemId]: voted }));
    }
  };

  return (
    <section className="tab-content">
      <div className="roadmap-hero">
        <h2>{UI_TEXT.title}</h2>
        <p className="meta">{UI_TEXT.subtitle}</p>
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
      </div>

      {isLoading ? <LoadingState /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && items.length === 0 ? <EmptyState message={UI_TEXT.emptyBoard} /> : null}
      {!isLoading && !error && items.length > 0 && filteredItems.length === 0 ? (
        <EmptyState message={UI_TEXT.emptyQuarter} />
      ) : null}

      {!isLoading && !error && items.length > 0 && filteredItems.length > 0 ? (
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
                          <span
                            className={
                              votedItems[item.id]
                                ? 'reaction-summary reaction-summary-active'
                                : 'reaction-summary'
                            }
                          >
                            <span className="reaction-summary-icon" aria-hidden="true">
                              {votedItems[item.id] ? '♥' : '♡'}
                            </span>
                            <strong>{item.votesCount}</strong>
                          </span>{' '}
                          • {UI_TEXT.comments}: <strong>{item.commentsCount}</strong>
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
              onRoadmapItemChange={onRoadmapItemChange}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};

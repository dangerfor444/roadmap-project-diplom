import type { IdeaSort, IdeaStatus, RoadmapStatus } from '../../types/public-api';

export type RoadmapFilter = RoadmapStatus | 'all';

export const ROADMAP_FILTERS: Array<{ value: RoadmapFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'planned', label: 'Запланировано' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Реализовано' },
];

export const IDEAS_SORTS: Array<{ value: IdeaSort; label: string }> = [
  { value: 'latest', label: 'Последние' },
  { value: 'popular', label: 'Популярные' },
  { value: 'discussed', label: 'Обсуждаемые' },
];

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  planned: 'Запланировано',
  in_progress: 'В работе',
  done: 'Реализовано',
};

export const ROADMAP_STATUS_OPTIONS: Array<{ value: RoadmapStatus; label: string }> = [
  { value: 'planned', label: ROADMAP_STATUS_LABEL.planned },
  { value: 'in_progress', label: ROADMAP_STATUS_LABEL.in_progress },
  { value: 'done', label: ROADMAP_STATUS_LABEL.done },
];

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'Новая',
  under_review: 'На рассмотрении',
  planned: 'Запланирована',
  declined: 'Отклонена',
  done: 'Реализована',
};

export const IDEA_STATUS_OPTIONS: Array<{ value: IdeaStatus; label: string }> = [
  { value: 'new', label: IDEA_STATUS_LABEL.new },
  { value: 'under_review', label: IDEA_STATUS_LABEL.under_review },
  { value: 'planned', label: IDEA_STATUS_LABEL.planned },
  { value: 'declined', label: IDEA_STATUS_LABEL.declined },
  { value: 'done', label: IDEA_STATUS_LABEL.done },
];

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

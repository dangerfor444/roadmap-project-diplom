import type { Core } from '@strapi/strapi';

const MANAGED_PERMISSION_PREFIXES = [
  'api::roadmap-item.roadmap-item.',
  'api::roadmap-comment.roadmap-comment.',
  'api::roadmap-vote.roadmap-vote.',
  'api::idea.idea.',
  'api::comment.comment.',
  'api::vote.vote.',
  'api::public.public.',
];

const ALLOWED_PUBLIC_ACTIONS = new Set([
  'api::public.public.roadmap',
  'api::public.public.roadmapItem',
  'api::public.public.roadmapVote',
  'api::public.public.roadmapUnvote',
  'api::public.public.roadmapComment',
  'api::public.public.ideas',
  'api::public.public.idea',
  'api::public.public.createIdea',
  'api::public.public.vote',
  'api::public.public.unvote',
  'api::public.public.comment',
]);

const isManagedAction = (action: string): boolean =>
  MANAGED_PERMISSION_PREFIXES.some((prefix) => action.startsWith(prefix));

const syncPublicPermissions = async (strapi: Core.Strapi): Promise<void> => {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) {
    strapi.log.warn('[RBAC] Public role was not found. Skipping permission sync.');
    return;
  }

  const permissionQuery = strapi.db.query('plugin::users-permissions.permission');
  const existingPermissions = await permissionQuery.findMany({
    where: { role: { id: publicRole.id } },
  });

  const existingActions = new Set(existingPermissions.map((permission) => permission.action));
  const managedPermissions = existingPermissions.filter((permission) =>
    isManagedAction(permission.action)
  );

  const actionsToCreate = [...ALLOWED_PUBLIC_ACTIONS].filter((action) => !existingActions.has(action));
  const permissionsToDelete = managedPermissions.filter(
    (permission) => !ALLOWED_PUBLIC_ACTIONS.has(permission.action)
  );

  await Promise.all(
    permissionsToDelete.map((permission) => permissionQuery.delete({ where: { id: permission.id } }))
  );

  await Promise.all(
    actionsToCreate.map((action) =>
      permissionQuery.create({
        data: {
          action,
          role: publicRole.id,
        },
      })
    )
  );

  if (actionsToCreate.length > 0 || permissionsToDelete.length > 0) {
    strapi.log.info(
      `[RBAC] Public permissions synced (created=${actionsToCreate.length}, removed=${permissionsToDelete.length}).`
    );
  }
};

const normalizeNullableCounters = async (strapi: Core.Strapi): Promise<void> => {
  const roadmapVotesUpdated = await strapi.db
    .connection('roadmap_items')
    .whereNull('votes_count')
    .update({ votes_count: 0 });

  const roadmapCommentsUpdated = await strapi.db
    .connection('roadmap_items')
    .whereNull('comments_count')
    .update({ comments_count: 0 });

  const ideasVotesUpdated = await strapi.db
    .connection('ideas')
    .whereNull('votes_count')
    .update({ votes_count: 0 });

  const totalUpdated = Number(roadmapVotesUpdated) + Number(roadmapCommentsUpdated) + Number(ideasVotesUpdated);
  if (totalUpdated > 0) {
    strapi.log.info(
      `[DATA] Counters normalized (roadmap.votes=${roadmapVotesUpdated}, roadmap.comments=${roadmapCommentsUpdated}, ideas.votes=${ideasVotesUpdated}).`
    );
  }
};

type SeedRoadmapItem = {
  title: string;
  description: string;
  status: 'planned' | 'in_progress' | 'done';
  category: string;
};

type SeedIdeaComment = {
  text: string;
  userFingerprint: string;
  isHidden: boolean;
};

type SeedIdeaItem = {
  title: string;
  description: string;
  status: 'new' | 'under_review' | 'planned' | 'declined' | 'done';
  votes: string[];
  comments: SeedIdeaComment[];
};

const seedRoadmapItems: SeedRoadmapItem[] = [
  {
    title: 'Р В Р’В Р РЋРЎСџР В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В Р РЏ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В° roadmap',
    description: 'Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’В Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚СњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ roadmap Р В Р Р‹Р В РЎвЂњ Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ.',
    status: 'done',
    category: 'Roadmap',
  },
  {
    title: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚Сњ Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В Р РЏР В Р’В Р РЋР’В',
    description: 'Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚в„–Р В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏР В Р Р‹Р В РІР‚в„–Р В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В.',
    status: 'in_progress',
    category: 'Feedback',
  },
  {
    title: 'Р В Р’В Р Р†Р вЂљРІвЂћСћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’ВР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў',
    description: 'Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В· embed.js Р В Р’В Р РЋРІР‚В iframe.',
    status: 'planned',
    category: 'Embed',
  },
];

const seedIdeas: SeedIdeaItem[] = [
  {
    title: 'Р В Р’В Р РЋРЎвЂєР В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В Р РЏ Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В° Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°',
    description: 'Р В Р’В Р Р†Р вЂљРЎСљР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В¶Р В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚Сљ Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’ВР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“.',
    status: 'under_review',
    votes: [
      'seed_vote_dark_001',
      'seed_vote_dark_002',
      'seed_vote_dark_003',
      'seed_vote_dark_004',
      'seed_vote_dark_005',
    ],
    comments: [
      {
        text: 'Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р Р‹Р В Р вЂ° Р В Р’В Р В РІР‚В¦Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В¶Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В Р В Р’В Р В РІР‚В  dark mode.',
        userFingerprint: 'seed_comment_dark_visible',
        isHidden: false,
      },
      {
        text: 'Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В° Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚Сћ Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚В Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’В-Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В.',
        userFingerprint: 'seed_comment_dark_hidden',
        isHidden: true,
      },
    ],
  },
  {
    title: 'Slack-Р В Р Р‹Р РЋРІР‚СљР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚Сћ Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљР’В¦ Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В Р РЏР В Р Р‹Р Р†Р вЂљР’В¦',
    description: 'Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚вЂќР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р Р‹Р РЋРІР‚СљР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ Р В Р’В Р В РІР‚В  Slack Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚В Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚В.',
    status: 'planned',
    votes: ['seed_vote_slack_001', 'seed_vote_slack_002', 'seed_vote_slack_003'],
    comments: [
      {
        text: 'Р В Р’В Р РЋРЎС™Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В¶Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ, Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ Р В Р’В Р В РІР‚В  Р В Р Р‹Р РЋРІР‚СљР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В Р В Р’В Р вЂ™Р’В±Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В° Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚в„–.',
        userFingerprint: 'seed_comment_slack_visible',
        isHidden: false,
      },
    ],
  },
  {
    title: 'Р В Р’В Р вЂ™Р’В­Р В Р’В Р РЋРІР‚СњР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р В РІР‚В  CSV',
    description: 'Р В Р’В Р Р†Р вЂљРІвЂћСћР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚В Р В Р’В Р В РІР‚В  CSV Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚СњР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚Сћ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ.',
    status: 'new',
    votes: ['seed_vote_csv_001', 'seed_vote_csv_002'],
    comments: [
      {
        text: 'Р В Р’В Р вЂ™Р’В­Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚Сћ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљР Р‹Р В Р Р‹Р Р†Р вЂљР’ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р’В Р РЋРІР‚СњР В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В .',
        userFingerprint: 'seed_comment_csv_visible',
        isHidden: false,
      },
    ],
  },
  {
    title: 'Р В Р’В Р РЋРЎСџР В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ API Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В¦ Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В ',
    description: 'Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° API Р В Р Р‹Р В РЎвЂњ Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В Р В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’В° Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В¦ Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ.',
    status: 'declined',
    votes: ['seed_vote_api_001'],
    comments: [
      {
        text: 'Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ: Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’В Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚Сњ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В° Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР’В°Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’В Р В Р Р‹Р В Р Р‰Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’Вµ MVP.',
        userFingerprint: 'seed_comment_api_visible',
        isHidden: false,
      },
    ],
  },
  {
    title: 'Р В Р’В Р РЋРІР‚в„ўР В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ changelog Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°',
    description: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚Сћ Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В· Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В  roadmap Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р Р‹Р В Р РЏР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљР’В¦ Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ.',
    status: 'done',
    votes: ['seed_vote_changelog_001', 'seed_vote_changelog_002', 'seed_vote_changelog_003'],
    comments: [
      {
        text: 'Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В Р РЏ Р В Р Р‹Р Р†Р вЂљРЎвЂєР В Р Р‹Р РЋРІР‚СљР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СњР В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р РЋР’ВР В Р Р‹Р РЋРІР‚СљР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В Р В Р Р‹Р В РЎвЂњ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В.',
        userFingerprint: 'seed_comment_changelog_visible',
        isHidden: false,
      },
    ],
  },
];

const isTrue = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isFalseLike = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off';
};

const isWidgetInternalAuthEnabled = (): boolean =>
  !isFalseLike(process.env.WIDGET_INTERNAL_AUTH_ENABLED || 'true');
const isWidgetEmailConfirmationEnabled = (): boolean =>
  !isFalseLike(process.env.WIDGET_AUTH_EMAIL_CONFIRMATION_ENABLED || 'true');
const asNonEmpty = (value?: string): string => (value ?? '').trim();

const normalizePasswordResetBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  // If URL points to /app, route directly to /app/roadmap to avoid losing query on redirect.
  return trimmed.replace(/\/app\/?(?=$|\?)/, '/app/roadmap');
};

const buildWidgetEmailConfirmationRedirect = (): string => {
  const explicitRedirect = asNonEmpty(process.env.WIDGET_AUTH_EMAIL_CONFIRMATION_REDIRECT);
  if (explicitRedirect) {
    return explicitRedirect;
  }

  const frontendOrigin = asNonEmpty(process.env.FRONTEND_ORIGIN);
  if (frontendOrigin) {
    return `${frontendOrigin.replace(/\/+$/, '')}/app/roadmap`;
  }

  return 'http://localhost:1337/app/roadmap';
};

const buildWidgetPasswordResetLink = (): string => {
  const explicitResetUrl = asNonEmpty(process.env.WIDGET_AUTH_PASSWORD_RESET_URL);
  const frontendOrigin = asNonEmpty(process.env.FRONTEND_ORIGIN);
  const confirmationRedirect = asNonEmpty(process.env.WIDGET_AUTH_EMAIL_CONFIRMATION_REDIRECT);

  const baseUrl =
    normalizePasswordResetBaseUrl(explicitResetUrl) ||
    (frontendOrigin ? `${frontendOrigin.replace(/\/+$/, '')}/app/roadmap` : '') ||
    normalizePasswordResetBaseUrl(confirmationRedirect) ||
    'http://localhost:1337/app/roadmap';

  if (baseUrl.endsWith('?') || baseUrl.endsWith('&')) {
    return `${baseUrl}resetCode=<%= TOKEN %>`;
  }

  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}resetCode=<%= TOKEN %>`;
};

const USERS_PERMISSIONS_EMAIL_TEMPLATES_RU: Record<string, { object: string; message: string }> = {
  email_confirmation: {
    object: '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430',
    message:
      '<p>\u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044e!</p>' +
      '<p>\u0414\u043b\u044f \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u044f \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043f\u043e\u0447\u0442\u0443 \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435:</p>' +
      '<p><%= URL %>?confirmation=<%= CODE %></p>' +
      '<p>\u0415\u0441\u043b\u0438 \u0432\u044b \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u043b\u0438 \u0430\u043a\u043a\u0430\u0443\u043d\u0442, \u043f\u0440\u043e\u0441\u0442\u043e \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u044d\u0442\u043e \u043f\u0438\u0441\u044c\u043c\u043e.</p>',
  },
  reset_password: {
    object: '\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f',
    message:
      '<p>\u0412\u044b \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u043b\u0438 \u0441\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f.</p>' +
      '<p>\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u043a\u043d\u043e\u043f\u043a\u0443 \u043d\u0438\u0436\u0435, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u0444\u043e\u0440\u043c\u0443 "\u0417\u0430\u0431\u044b\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c?" \u0441 \u0443\u0436\u0435 \u043f\u043e\u0434\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u043d\u044b\u043c \u043a\u043e\u0434\u043e\u043c.</p>' +
      `<p><a href="${buildWidgetPasswordResetLink()}" target="_blank" rel="noopener">\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c</a></p>` +
      '<p>\u0415\u0441\u043b\u0438 \u043a\u043d\u043e\u043f\u043a\u0430 \u043d\u0435 \u043e\u0442\u043a\u0440\u044b\u043b\u0430\u0441\u044c, \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043a\u043e\u0434 \u0432\u0440\u0443\u0447\u043d\u0443\u044e:</p>' +
      '<p><strong><%= TOKEN %></strong></p>' +
      '<p>\u0415\u0441\u043b\u0438 \u044d\u0442\u043e \u0431\u044b\u043b\u0438 \u043d\u0435 \u0432\u044b, \u043f\u0440\u043e\u0441\u0442\u043e \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u044d\u0442\u043e \u043f\u0438\u0441\u044c\u043c\u043e.</p>',
  },
};

const ensureWidgetInternalAuthSettings = async (strapi: Core.Strapi): Promise<void> => {
  if (!isWidgetInternalAuthEnabled()) {
    return;
  }

  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });

  const emailConfirmationEnabled = isWidgetEmailConfirmationEnabled();
  const emailConfirmationRedirect = buildWidgetEmailConfirmationRedirect();
  const advanced = ((await store.get({ key: 'advanced' })) as Record<string, unknown> | null) ?? {};

  const nextAdvanced: Record<string, unknown> = { ...advanced };
  let shouldSaveAdvanced = false;
  if (advanced.allow_register !== true) {
    nextAdvanced.allow_register = true;
    shouldSaveAdvanced = true;
  }
  if (advanced.email_confirmation !== emailConfirmationEnabled) {
    nextAdvanced.email_confirmation = emailConfirmationEnabled;
    shouldSaveAdvanced = true;
  }
  if (emailConfirmationRedirect && advanced.email_confirmation_redirection !== emailConfirmationRedirect) {
    nextAdvanced.email_confirmation_redirection = emailConfirmationRedirect;
    shouldSaveAdvanced = true;
  }

  if (shouldSaveAdvanced) {
    await store.set({
      key: 'advanced',
      value: nextAdvanced,
    });
    strapi.log.info(
      `[AUTH] users-permissions settings synced (allow_register=true, email_confirmation=${String(emailConfirmationEnabled)}).`
    );
  }

  const grant = (await store.get({ key: 'grant' })) as Record<string, any> | null;
  const emailProvider = grant?.email;
  if (grant && emailProvider && emailProvider.enabled !== true) {
    await store.set({
      key: 'grant',
      value: {
        ...grant,
        email: {
          ...emailProvider,
          enabled: true,
        },
      },
    });
    strapi.log.info('[AUTH] users-permissions local/email provider was enabled for widget internal auth.');
  }
};

const ensureUsersPermissionsEmailSender = async (strapi: Core.Strapi): Promise<void> => {
  if (!isWidgetInternalAuthEnabled()) {
    return;
  }

  const fromEmail = asNonEmpty(process.env.EMAIL_DEFAULT_FROM || process.env.SMTP_USER);
  if (!fromEmail) {
    strapi.log.warn('[AUTH] EMAIL_DEFAULT_FROM/SMTP_USER is empty. Skip users-permissions email sender sync.');
    return;
  }

  const fromName = asNonEmpty(process.env.EMAIL_FROM_NAME) || 'Roadmap Platform';
  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const emailConfig = (await store.get({ key: 'email' })) as Record<string, any> | null;

  if (!emailConfig || typeof emailConfig !== 'object') {
    return;
  }

  const templateKeys = ['email_confirmation', 'reset_password'];
  const nextEmailConfig: Record<string, any> = { ...emailConfig };
  let changed = false;

  for (const templateKey of templateKeys) {
    const template = nextEmailConfig[templateKey];
    if (!template || typeof template !== 'object') {
      continue;
    }

    const options =
      template.options && typeof template.options === 'object'
        ? { ...template.options }
        : {};
    const from = options.from && typeof options.from === 'object' ? { ...options.from } : {};
    const ruTemplate = USERS_PERMISSIONS_EMAIL_TEMPLATES_RU[templateKey];
    const nextObject = ruTemplate?.object ?? options.object;
    const nextMessage = ruTemplate?.message ?? options.message;

    if (
      from.email === fromEmail &&
      from.name === fromName &&
      options.response_email === fromEmail &&
      options.object === nextObject &&
      options.message === nextMessage
    ) {
      continue;
    }

    nextEmailConfig[templateKey] = {
      ...template,
      options: {
        ...options,
        from: {
          ...from,
          name: fromName,
          email: fromEmail,
        },
        response_email: fromEmail,
        object: nextObject,
        message: nextMessage,
      },
    };
    changed = true;
  }

  if (changed) {
    await store.set({ key: 'email', value: nextEmailConfig });
    strapi.log.info(`[AUTH] users-permissions email sender synced to ${fromEmail}.`);
  }
};

const resetMvpData = async (strapi: Core.Strapi): Promise<void> => {
  await strapi.db.query('api::vote.vote').deleteMany({ where: {} });
  await strapi.db.query('api::comment.comment').deleteMany({ where: {} });
  await strapi.db.query('api::idea.idea').deleteMany({ where: {} });
  await strapi.db.query('api::roadmap-item.roadmap-item').deleteMany({ where: {} });
};

const seedMvpData = async (strapi: Core.Strapi): Promise<void> => {
  if (isTrue(process.env.SEED_MVP_RESET)) {
    await resetMvpData(strapi);
    strapi.log.info('[SEED] Existing roadmap/ideas/comments/votes were reset.');
  }

  for (const item of seedRoadmapItems) {
    const roadmapQuery = strapi.db.query('api::roadmap-item.roadmap-item');
    const existing = await roadmapQuery.findOne({
      where: { title: item.title },
    });

    if (!existing) {
      await roadmapQuery.create({
        data: {
          title: item.title,
          description: item.description,
          status: item.status,
          category: item.category,
        },
      });
      continue;
    }

    await roadmapQuery.update({
      where: { id: existing.id },
      data: {
        description: item.description,
        status: item.status,
        category: item.category,
      },
    });
  }

  for (const ideaSeed of seedIdeas) {
    const ideaQuery = strapi.db.query('api::idea.idea');
    const voteQuery = strapi.db.query('api::vote.vote');
    const commentQuery = strapi.db.query('api::comment.comment');

    let idea = await ideaQuery.findOne({
      where: { title: ideaSeed.title },
    });

    if (!idea) {
      idea = await ideaQuery.create({
        data: {
          title: ideaSeed.title,
          description: ideaSeed.description,
          status: ideaSeed.status,
          votesCount: 0,
        },
      });
    } else {
      await ideaQuery.update({
        where: { id: idea.id },
        data: {
          description: ideaSeed.description,
          status: ideaSeed.status,
        },
      });
    }

    for (const fingerprint of ideaSeed.votes) {
      const existingVote = await voteQuery.findOne({
        where: {
          ideaDocumentId: idea.documentId,
          userFingerprint: fingerprint,
        },
      });

      if (!existingVote) {
        await voteQuery.create({
          data: {
            idea: idea.id,
            ideaDocumentId: idea.documentId,
            userFingerprint: fingerprint,
          },
        });
      }
    }

    for (const commentSeed of ideaSeed.comments) {
      const existingComment = await commentQuery.findOne({
        where: {
          idea: idea.id,
          userFingerprint: commentSeed.userFingerprint,
        },
      });

      if (!existingComment) {
        await commentQuery.create({
          data: {
            idea: idea.id,
            text: commentSeed.text,
            userFingerprint: commentSeed.userFingerprint,
            isHidden: commentSeed.isHidden,
          },
        });
        continue;
      }

      await commentQuery.update({
        where: { id: existingComment.id },
        data: {
          text: commentSeed.text,
          isHidden: commentSeed.isHidden,
        },
      });
    }

    const voteCount = await voteQuery.count({
      where: { ideaDocumentId: idea.documentId },
    });

    if (idea.votesCount !== voteCount) {
      await ideaQuery.update({
        where: { id: idea.id },
        data: { votesCount: voteCount },
      });
    }
  }
};

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await normalizeNullableCounters(strapi);
    await ensureWidgetInternalAuthSettings(strapi);
    await ensureUsersPermissionsEmailSender(strapi);
    await syncPublicPermissions(strapi);

    if (isTrue(process.env.SEED_MVP_DATA)) {
      await seedMvpData(strapi);
      strapi.log.info('[SEED] MVP data ensured.');
    }
  },
};

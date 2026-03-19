const crypto = require('crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: '.env' });

const DEMO_USER_EMAILS = [
  'anna.demo@roadmap.test',
  'nikita.demo@roadmap.test',
  'olga.demo@roadmap.test',
  'sergey.demo@roadmap.test',
  'maria.demo@roadmap.test',
];

const ROADMAP_COMMENT_TEMPLATES = [
  (item) =>
    `Поддерживаю пункт roadmap «${item.title}». Хочется видеть его в одном из ближайших релизов.`,
  (item) =>
    `Здесь особенно важна понятная коммуникация статуса. По «${item.title}» пользователи точно будут задавать вопросы.`,
  (item) =>
    `Хороший шаг. Если добавить короткое обновление по прогрессу для «${item.title}», экран roadmap станет ещё полезнее.`,
  (item) =>
    `Этот элемент выглядит приоритетным. Было бы здорово оставить его заметным на публичной странице roadmap.`,
  (item) =>
    `Поддерживаю обсуждение вокруг «${item.title}». Чем больше обратной связи соберём здесь, тем проще будет обосновать приоритет.`,
];

const IDEA_COMMENT_TEMPLATES = [
  (idea) =>
    `Мне нравится идея «${idea.title}». Такой сценарий действительно выглядит полезным для пользователей.`,
  (idea) =>
    `Поддерживаю. По идее «${idea.title}» было бы интересно увидеть оценку сложности и приоритета.`,
  (idea) =>
    `Хорошее предложение. Если взять «${idea.title}» в работу, это можно красиво показать и в roadmap, и в changelog.`,
  (idea) =>
    `Кажется, это одна из тех идей, за которыми люди будут следить. «${idea.title}» точно заслуживает обсуждения.`,
  (idea) =>
    `Полезная идея. По «${idea.title}» хорошо бы собрать ещё пару кейсов использования от пользователей.`,
  (idea) =>
    `Поддерживаю это направление. Идея «${idea.title}» выглядит достаточно понятной даже без дополнительного контекста.`,
];

const createClient = () =>
  new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

const makeDocumentId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 24);

const getFingerprintByUser = (user) => `actor:user:${user.id}`;

const loadDemoUsers = async (client) => {
  const demoUsers = await client.query(
    `
      SELECT id, email, username
      FROM up_users
      WHERE email = ANY($1)
      ORDER BY id ASC
    `,
    [DEMO_USER_EMAILS]
  );

  if (demoUsers.rows.length >= 2) {
    return demoUsers.rows;
  }

  const fallbackUsers = await client.query(
    `
      SELECT id, email, username
      FROM up_users
      ORDER BY id ASC
      LIMIT 5
    `
  );

  if (fallbackUsers.rows.length < 2) {
    throw new Error('Не удалось найти пользователей для demo-комментариев. Нужны минимум 2 аккаунта.');
  }

  return fallbackUsers.rows;
};

const loadRoadmapItems = async (client) => {
  const result = await client.query(`
    SELECT id, title
    FROM roadmap_items
    WHERE COALESCE(is_hidden, false) = false
    ORDER BY created_at ASC, id ASC
  `);

  return result.rows;
};

const loadIdeas = async (client) => {
  const result = await client.query(`
    SELECT id, title
    FROM ideas
    WHERE COALESCE(is_hidden, false) = false
    ORDER BY created_at ASC, id ASC
  `);

  return result.rows;
};

const buildCommentPlan = (entities, users, templates, commentsPerEntity) => {
  const plan = [];

  entities.forEach((entity, entityIndex) => {
    for (let offset = 0; offset < commentsPerEntity; offset += 1) {
      const user = users[(entityIndex + offset) % users.length];
      const template = templates[(entityIndex + offset) % templates.length];

      plan.push({
        entity,
        user,
        text: template(entity),
      });
    }
  });

  return plan;
};

const ensureIdeaComment = async (client, ideaId, userFingerprint, text) => {
  const existing = await client.query(
    `
      SELECT c.id
      FROM comments c
      INNER JOIN comments_idea_lnk lnk ON lnk.comment_id = c.id
      WHERE lnk.idea_id = $1
        AND c.user_fingerprint = $2
        AND c.text = $3
      LIMIT 1
    `,
    [ideaId, userFingerprint, text]
  );

  if (existing.rows.length > 0) {
    return false;
  }

  const insertedComment = await client.query(
    `
      INSERT INTO comments (document_id, text, user_fingerprint, is_hidden, created_at, updated_at, published_at)
      VALUES ($1, $2, $3, false, NOW(), NOW(), NOW())
      RETURNING id
    `,
    [makeDocumentId(), text, userFingerprint]
  );

  const commentId = insertedComment.rows[0].id;
  await client.query(
    `
      INSERT INTO comments_idea_lnk (comment_id, idea_id, comment_ord)
      VALUES ($1, $2, $3)
    `,
    [commentId, ideaId, commentId]
  );

  return true;
};

const ensureRoadmapComment = async (client, roadmapItemId, userFingerprint, text) => {
  const existing = await client.query(
    `
      SELECT c.id
      FROM roadmap_comments c
      INNER JOIN roadmap_comments_roadmap_item_lnk lnk ON lnk.roadmap_comment_id = c.id
      WHERE lnk.roadmap_item_id = $1
        AND c.user_fingerprint = $2
        AND c.text = $3
      LIMIT 1
    `,
    [roadmapItemId, userFingerprint, text]
  );

  if (existing.rows.length > 0) {
    return false;
  }

  const insertedComment = await client.query(
    `
      INSERT INTO roadmap_comments (document_id, text, user_fingerprint, is_hidden, created_at, updated_at, published_at)
      VALUES ($1, $2, $3, false, NOW(), NOW(), NOW())
      RETURNING id
    `,
    [makeDocumentId(), text, userFingerprint]
  );

  const commentId = insertedComment.rows[0].id;
  await client.query(
    `
      INSERT INTO roadmap_comments_roadmap_item_lnk (roadmap_comment_id, roadmap_item_id, roadmap_comment_ord)
      VALUES ($1, $2, $3)
    `,
    [commentId, roadmapItemId, commentId]
  );

  return true;
};

const syncRoadmapCommentCounters = async (client) => {
  await client.query(`
    UPDATE roadmap_items
    SET comments_count = 0
  `);

  await client.query(`
    UPDATE roadmap_items AS ri
    SET comments_count = src.comments_count
    FROM (
      SELECT lnk.roadmap_item_id, COUNT(*)::int AS comments_count
      FROM roadmap_comments rc
      INNER JOIN roadmap_comments_roadmap_item_lnk lnk
        ON lnk.roadmap_comment_id = rc.id
      WHERE COALESCE(rc.is_hidden, false) = false
      GROUP BY lnk.roadmap_item_id
    ) AS src
    WHERE ri.id = src.roadmap_item_id
  `);
};

const main = async () => {
  const client = createClient();
  await client.connect();

  try {
    const users = await loadDemoUsers(client);
    const roadmapItems = await loadRoadmapItems(client);
    const ideas = await loadIdeas(client);

    const stats = {
      roadmapCommentsCreated: 0,
      ideaCommentsCreated: 0,
    };

    const roadmapPlan = buildCommentPlan(roadmapItems, users, ROADMAP_COMMENT_TEMPLATES, 3);
    for (const item of roadmapPlan) {
      const created = await ensureRoadmapComment(
        client,
        item.entity.id,
        getFingerprintByUser(item.user),
        item.text
      );

      if (created) {
        stats.roadmapCommentsCreated += 1;
      }
    }

    const ideaPlan = buildCommentPlan(ideas, users, IDEA_COMMENT_TEMPLATES, 4);
    for (const item of ideaPlan) {
      const created = await ensureIdeaComment(
        client,
        item.entity.id,
        getFingerprintByUser(item.user),
        item.text
      );

      if (created) {
        stats.ideaCommentsCreated += 1;
      }
    }

    await syncRoadmapCommentCounters(client);

    console.log('Дополнительные demo-комментарии успешно добавлены.');
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error('Не удалось добавить дополнительные demo-комментарии.');
  console.error(error);
  process.exit(1);
});

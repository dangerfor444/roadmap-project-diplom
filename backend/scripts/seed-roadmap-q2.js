const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createStrapi } = require('@strapi/strapi');

const DEMO_USER_EMAILS = [
  'anna.demo@roadmap.test',
  'nikita.demo@roadmap.test',
  'olga.demo@roadmap.test',
  'sergey.demo@roadmap.test',
  'maria.demo@roadmap.test',
];

const ROADMAP_ITEMS = [
  {
    key: 'brand-widget',
    title: 'Брендирование виджета под стиль клиента',
    description:
      'Добавляем настройку цветов, типографики и скруглений, чтобы компания могла встроить roadmap и идеи без ощущения чужого интерфейса на своём сайте.',
    status: 'in_progress',
    category: 'Виджет',
  },
  {
    key: 'quarter-filter',
    title: 'Фильтр roadmap по кварталам',
    description:
      'На публичной странице roadmap появится удобное переключение между кварталами, чтобы список задач не разрастался бесконечно и оставался читаемым.',
    status: 'done',
    category: 'Roadmap',
  },
  {
    key: 'release-notes',
    title: 'Короткие заметки о релизах рядом с roadmap',
    description:
      'После завершения задач команда сможет публиковать короткие заметки о том, что именно вошло в релиз и какие улучшения уже доступны пользователям.',
    status: 'planned',
    category: 'Коммуникация',
  },
  {
    key: 'manager-analytics',
    title: 'Блок аналитики для менеджера по идеям и roadmap',
    description:
      'В панели управления появятся сводные метрики по лайкам, комментариям и самым обсуждаемым карточкам, чтобы быстрее понимать интерес аудитории.',
    status: 'planned',
    category: 'Управление',
  },
  {
    key: 'email-digest',
    title: 'Email-дайджест по новым реакциям и комментариям',
    description:
      'Менеджер сможет получать регулярную подборку новых обсуждений, реакций и активных карточек, не заходя в панель управления каждый день.',
    status: 'in_progress',
    category: 'Уведомления',
  },
  {
    key: 'idea-merge',
    title: 'Объединение похожих идей пользователей',
    description:
      'Если пользователи создают несколько очень похожих идей, менеджер сможет объединить их в одну карточку без потери голосов и комментариев.',
    status: 'planned',
    category: 'Идеи',
  },
  {
    key: 'public-subscribe',
    title: 'Подписка на обновления по выбранной задаче',
    description:
      'Пользователь сможет подписаться на конкретную задачу roadmap и получать уведомления, когда она сменит статус или по ней появятся новости.',
    status: 'planned',
    category: 'Уведомления',
  },
  {
    key: 'roadmap-archive',
    title: 'Архив завершённых задач за прошлые кварталы',
    description:
      'Реализованные задачи будут аккуратно складываться в архив, чтобы публичный roadmap показывал текущие планы, но история работы продукта не терялась.',
    status: 'done',
    category: 'Платформа',
  },
];

const ROADMAP_VOTES = [
  ['brand-widget', ['anna', 'nikita', 'maria', 'sergey']],
  ['quarter-filter', ['anna', 'nikita', 'olga', 'maria']],
  ['release-notes', ['anna', 'sergey', 'maria']],
  ['manager-analytics', ['nikita', 'olga', 'sergey']],
  ['email-digest', ['anna', 'olga', 'maria']],
  ['idea-merge', ['anna', 'nikita', 'sergey', 'maria']],
  ['public-subscribe', ['anna', 'nikita', 'olga']],
  ['roadmap-archive', ['nikita', 'sergey', 'maria']],
];

const ROADMAP_COMMENTS = [
  [
    'brand-widget',
    'anna',
    'Это особенно важно для встраивания на маркетинговые сайты. Сейчас, когда виджет можно показывать на демо-странице, брендирование выглядит следующим логичным шагом.',
  ],
  [
    'brand-widget',
    'maria',
    'Хочется, чтобы компания могла настроить не только цвет кнопок, но и общий тон карточек, иначе на разных сайтах виджет будет смотреться слишком одинаково.',
  ],
  [
    'brand-widget',
    'sergey',
    'Для продаж это сильный аргумент: клиенту проще купить решение, когда он видит, что интерфейс можно быстро адаптировать под фирменный стиль.',
  ],
  [
    'quarter-filter',
    'nikita',
    'Отличное улучшение. Когда задач станет много, без кварталов публичный roadmap будет перегружен и пользователю станет трудно ориентироваться.',
  ],
  [
    'quarter-filter',
    'olga',
    'Самый удобный сценарий — открывать текущий квартал по умолчанию и давать возможность спокойно листать назад и вперёд по стрелкам.',
  ],
  [
    'release-notes',
    'anna',
    'Если рядом с выполненной задачей будет короткая заметка о релизе, пользователям станет проще понимать, что именно уже появилось в продукте.',
  ],
  [
    'release-notes',
    'maria',
    'Это ещё и полезно для презентаций продукта: можно показать не только планы, но и уже закрытые изменения с понятным пояснением.',
  ],
  [
    'manager-analytics',
    'sergey',
    'Нужны хотя бы базовые метрики: самые лайкаемые идеи, самые обсуждаемые задачи roadmap и динамика активности за неделю.',
  ],
  [
    'manager-analytics',
    'olga',
    'Для менеджера это сильно сократит ручной просмотр карточек. Сразу будет видно, где больше всего интереса и где нужно ответить пользователям.',
  ],
  [
    'manager-analytics',
    'nikita',
    'Если добавить это в верхнюю часть панели управления, получится очень убедительный экран для демонстрации заказчику.',
  ],
  [
    'email-digest',
    'anna',
    'Полезно получать дайджест утром: сразу видишь, какие новые идеи появились и где началось активное обсуждение.',
  ],
  [
    'email-digest',
    'maria',
    'Главное, чтобы можно было выбрать частоту: ежедневно, раз в неделю или только по самым важным карточкам.',
  ],
  [
    'idea-merge',
    'sergey',
    'Сейчас при активном росте аудитории похожих идей будет много. Объединение действительно поможет не распылять голоса.',
  ],
  [
    'idea-merge',
    'anna',
    'Важно, чтобы при объединении сохранялись комментарии и было видно, какая идея стала основной.',
  ],
  [
    'idea-merge',
    'maria',
    'Это ещё упростит аналитику: вместо трёх похожих карточек будет одна сильная идея с нормальным количеством реакций.',
  ],
  [
    'public-subscribe',
    'olga',
    'Подписка на конкретную задачу полезна для B2B-клиентов: они смогут следить только за теми функциями, которые важны их команде.',
  ],
  [
    'public-subscribe',
    'nikita',
    'Хорошо бы отправлять уведомление, когда задача переходит из planned в in progress, это самый ожидаемый момент для пользователей.',
  ],
  [
    'roadmap-archive',
    'sergey',
    'Архив завершённых задач нужен обязательно. Иначе через несколько кварталов колонка «Реализовано» просто станет слишком длинной.',
  ],
  [
    'roadmap-archive',
    'maria',
    'Для публичной страницы это очень правильный подход: текущий roadmap остаётся компактным, а история продукта никуда не исчезает.',
  ],
];

const APP_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(APP_DIR, 'dist');

const ensureEnvLoaded = () => {
  dotenv.config({ path: path.join(APP_DIR, '.env') });
};

const ensureDistExists = () => {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('Не найден backend/dist. Сначала выполните: cd backend && npm run build');
  }
};

const createApp = async () => {
  ensureEnvLoaded();
  ensureDistExists();
  process.chdir(APP_DIR);

  const strapi = createStrapi({
    appDir: APP_DIR,
    distDir: DIST_DIR,
    autoReload: false,
    serveAdminPanel: false,
  });

  await strapi.load();
  return strapi;
};

const getFingerprintByUser = (user) => `actor:user:${user.id}`;

const loadUsers = async (strapi) => {
  const demoUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
    where: {
      email: {
        $in: DEMO_USER_EMAILS,
      },
    },
    select: ['id', 'email', 'username'],
  });

  const users = demoUsers.length >= 3
    ? demoUsers
    : await strapi.db.query('plugin::users-permissions.user').findMany({
        select: ['id', 'email', 'username'],
        limit: 5,
      });

  if (users.length < 3) {
    throw new Error('Не удалось найти достаточно пользователей для seed roadmap. Нужно минимум 3 аккаунта.');
  }

  return users;
};

const ensureRoadmapItem = async (strapi, definition) => {
  const existing = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
    where: { title: definition.title },
  });

  if (existing) {
    return { entry: existing, created: false };
  }

  const created = await strapi.db.query('api::roadmap-item.roadmap-item').create({
    data: {
      title: definition.title,
      description: definition.description,
      status: definition.status,
      category: definition.category,
      votesCount: 0,
      commentsCount: 0,
      isHidden: false,
    },
  });

  return { entry: created, created: true };
};

const ensureRoadmapVote = async (strapi, roadmapItem, userFingerprint) => {
  const existing = await strapi.db.query('api::roadmap-vote.roadmap-vote').findOne({
    where: {
      roadmapItemDocumentId: roadmapItem.documentId,
      userFingerprint,
    },
  });

  if (existing) {
    return false;
  }

  await strapi.db.query('api::roadmap-vote.roadmap-vote').create({
    data: {
      roadmapItem: roadmapItem.id,
      roadmapItemDocumentId: roadmapItem.documentId,
      userFingerprint,
    },
  });

  return true;
};

const ensureRoadmapComment = async (strapi, roadmapItem, userFingerprint, text) => {
  const candidates = await strapi.db.query('api::roadmap-comment.roadmap-comment').findMany({
    where: { text, userFingerprint },
    populate: {
      roadmapItem: {
        select: ['id'],
      },
    },
  });

  const exists = candidates.some((comment) => comment.roadmapItem?.id === roadmapItem.id);
  if (exists) {
    return false;
  }

  await strapi.db.query('api::roadmap-comment.roadmap-comment').create({
    data: {
      roadmapItem: roadmapItem.id,
      text,
      userFingerprint,
      isHidden: false,
    },
  });

  return true;
};

const syncRoadmapCounts = async (strapi, roadmapItem) => {
  const votesCount = await strapi.db.query('api::roadmap-vote.roadmap-vote').count({
    where: {
      roadmapItemDocumentId: roadmapItem.documentId,
    },
  });

  const comments = await strapi.db.query('api::roadmap-comment.roadmap-comment').findMany({
    where: { isHidden: false },
    populate: {
      roadmapItem: {
        select: ['id'],
      },
    },
    select: ['id'],
  });

  const commentsCount = comments.filter((comment) => comment.roadmapItem?.id === roadmapItem.id).length;

  await strapi.db.query('api::roadmap-item.roadmap-item').update({
    where: { id: roadmapItem.id },
    data: { votesCount, commentsCount },
  });
};

const main = async () => {
  const strapi = await createApp();

  try {
    const users = await loadUsers(strapi);
    const usersByKey = new Map(
      users.map((user) => [String(user.username || user.email).split('.')[0].toLowerCase(), user])
    );
    const roadmapByKey = new Map();

    const stats = {
      roadmapCreated: 0,
      roadmapVotesCreated: 0,
      roadmapCommentsCreated: 0,
    };

    for (const definition of ROADMAP_ITEMS) {
      const result = await ensureRoadmapItem(strapi, definition);
      roadmapByKey.set(definition.key, result.entry);
      if (result.created) {
        stats.roadmapCreated += 1;
      }
    }

    for (const [roadmapKey, userKeys] of ROADMAP_VOTES) {
      const roadmapItem = roadmapByKey.get(roadmapKey);
      for (const userKey of userKeys) {
        const user = usersByKey.get(userKey);
        if (!roadmapItem || !user) {
          continue;
        }

        const created = await ensureRoadmapVote(strapi, roadmapItem, getFingerprintByUser(user));
        if (created) {
          stats.roadmapVotesCreated += 1;
        }
      }
    }

    for (const [roadmapKey, userKey, text] of ROADMAP_COMMENTS) {
      const roadmapItem = roadmapByKey.get(roadmapKey);
      const user = usersByKey.get(userKey);
      if (!roadmapItem || !user) {
        continue;
      }

      const created = await ensureRoadmapComment(strapi, roadmapItem, getFingerprintByUser(user), text);
      if (created) {
        stats.roadmapCommentsCreated += 1;
      }
    }

    for (const roadmapItem of roadmapByKey.values()) {
      await syncRoadmapCounts(strapi, roadmapItem);
    }

    console.log('Демо-задачи roadmap для текущего квартала успешно подготовлены.');
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await strapi.destroy();
  }
};

main().catch((error) => {
  console.error('Не удалось подготовить demo-задачи roadmap.');
  console.error(error);
  process.exit(1);
});

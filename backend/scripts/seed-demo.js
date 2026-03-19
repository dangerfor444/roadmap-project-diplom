const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createStrapi } = require('@strapi/strapi');

const DEMO_PASSWORD = 'Demo12345!';

const DEMO_USERS = [
  { key: 'anna', username: 'anna', email: 'anna.demo@roadmap.test' },
  { key: 'nikita', username: 'nikita', email: 'nikita.demo@roadmap.test' },
  { key: 'olga', username: 'olga', email: 'olga.demo@roadmap.test' },
  { key: 'sergey', username: 'sergey', email: 'sergey.demo@roadmap.test' },
  { key: 'maria', username: 'maria', email: 'maria.demo@roadmap.test' },
];

const ROADMAP_ITEMS = [
  {
    key: 'embed-widget',
    title: 'Встраиваемый JS-виджет',
    description:
      'Делаем простой способ встроить публичный roadmap и идеи на сайт продукта через iframe и embed.js.',
    status: 'done',
    category: 'Виджет',
  },
  {
    key: 'interactive-roadmap',
    title: 'Комментарии и реакции к roadmap',
    description:
      'Пользователи смогут обсуждать roadmap-элементы, ставить лайки и оставлять комментарии прямо в публичном интерфейсе.',
    status: 'in_progress',
    category: 'Roadmap',
  },
  {
    key: 'manager-panel',
    title: 'Внутренняя панель менеджера',
    description:
      'Отдельный интерфейс для продукт-менеджера: управление roadmap, статусами идей и модерацией комментариев.',
    status: 'in_progress',
    category: 'Управление',
  },
  {
    key: 'widget-auth',
    title: 'Авторизация внутри виджета',
    description:
      'Пользователь сможет войти, зарегистрироваться и выполнять действия записи без зависимости от авторизации на внешнем сайте.',
    status: 'done',
    category: 'Авторизация',
  },
  {
    key: 'email-confirmation',
    title: 'Подтверждение email при регистрации',
    description:
      'После регистрации пользователь получает письмо для подтверждения почты и завершения активации аккаунта.',
    status: 'done',
    category: 'Авторизация',
  },
  {
    key: 'host-sso',
    title: 'Интеграция с внешней SSO сайта',
    description:
      'Хост-сайт сможет передавать идентификатор уже авторизованного пользователя в виджет через подписанный токен.',
    status: 'planned',
    category: 'Интеграции',
  },
  {
    key: 'multi-project',
    title: 'Поддержка нескольких продуктов',
    description:
      'Одна платформа сможет обслуживать несколько продуктовых roadmap и boards обратной связи с разделением данных.',
    status: 'planned',
    category: 'Платформа',
  },
];

const IDEAS = [
  {
    key: 'dark-theme',
    title: 'Тёмная тема для виджета',
    description:
      'Хочу, чтобы виджет и публичная страница могли переключаться в тёмную тему и подстраиваться под стиль сайта.',
    status: 'new',
    author: 'anna',
  },
  {
    key: 'release-subscription',
    title: 'Подписка на обновления идеи',
    description:
      'Полезно отправлять уведомления тем, кто голосовал за идею, когда она переходит в работу или реализуется.',
    status: 'under_review',
    author: 'nikita',
  },
  {
    key: 'export-csv',
    title: 'Экспорт идей в CSV',
    description:
      'Нужен простой экспорт списка идей и их статусов для презентаций, отчётов и ручной аналитики.',
    status: 'planned',
    author: 'sergey',
  },
  {
    key: 'roadmap-priority',
    title: 'Сортировка roadmap по приоритету',
    description:
      'Команде будет удобнее управлять roadmap, если в панели менеджера можно будет задавать ручной приоритет карточек.',
    status: 'done',
    author: 'olga',
  },
  {
    key: 'multi-reactions',
    title: 'Несколько типов реакций вместо одного лайка',
    description:
      'Иногда хочется различать «хочу это», «полезно» и «важно сейчас», а не только ставить один универсальный лайк.',
    status: 'declined',
    author: 'maria',
  },
  {
    key: 'webhooks',
    title: 'Webhook при смене статуса идеи',
    description:
      'При переводе идеи между статусами хорошо бы отправлять событие во внешние сервисы и внутренние боты команды.',
    status: 'planned',
    author: 'anna',
  },
  {
    key: 'public-changelog',
    title: 'Публичный changelog рядом с roadmap',
    description:
      'После релизов хочется публиковать короткие заметки об изменениях рядом с roadmap, чтобы не плодить отдельные страницы.',
    status: 'new',
    author: 'maria',
  },
  {
    key: 'telegram-notify',
    title: 'Уведомления в Telegram о новых комментариях',
    description:
      'Менеджеру было бы удобно получать уведомления о новых обсуждениях идей и roadmap-элементов в Telegram.',
    status: 'under_review',
    author: 'nikita',
  },
  {
    key: 'inline-like',
    title: 'Быстрый лайк без перехода в детали идеи',
    description:
      'На списке идей хочется ставить и снимать лайк сразу в карточке, без лишних переходов между экранами.',
    status: 'planned',
    author: 'sergey',
  },
  {
    key: 'forms-import',
    title: 'Импорт идей из Google Forms',
    description:
      'Было бы здорово подтягивать идеи из внешней формы, но пока это создаёт слишком много сложностей с очисткой и модерацией данных.',
    status: 'declined',
    author: 'olga',
  },
];

const ROADMAP_VOTES = [
  ['embed-widget', 'anna'],
  ['embed-widget', 'nikita'],
  ['embed-widget', 'sergey'],
  ['interactive-roadmap', 'anna'],
  ['interactive-roadmap', 'olga'],
  ['interactive-roadmap', 'maria'],
  ['manager-panel', 'nikita'],
  ['manager-panel', 'olga'],
  ['widget-auth', 'anna'],
  ['widget-auth', 'maria'],
  ['email-confirmation', 'sergey'],
  ['host-sso', 'anna'],
  ['host-sso', 'sergey'],
  ['multi-project', 'nikita'],
  ['multi-project', 'maria'],
];

const ROADMAP_COMMENTS = [
  ['interactive-roadmap', 'anna', 'Очень не хватает обсуждения прямо внутри roadmap, без перехода в отдельные формы.'],
  ['interactive-roadmap', 'sergey', 'Если здесь будут реакции и комментарии, экран roadmap станет намного живее для пользователей.'],
  ['manager-panel', 'olga', 'Для демо важно, чтобы менеджер мог менять статусы и быстро скрывать неподходящий контент.'],
  ['widget-auth', 'maria', 'Отдельная авторизация внутри виджета выглядит надёжнее для встраивания на любые сайты.'],
  ['host-sso', 'nikita', 'SSO особенно пригодится, если виджет будут встраивать в существующий кабинет продукта.'],
  ['multi-project', 'anna', 'Поддержка нескольких продуктов точно нужна, если платформу будут показывать как самостоятельный сервис.'],
];

const IDEA_VOTES = [
  ['dark-theme', 'nikita'],
  ['dark-theme', 'olga'],
  ['dark-theme', 'maria'],
  ['release-subscription', 'anna'],
  ['release-subscription', 'sergey'],
  ['export-csv', 'anna'],
  ['export-csv', 'nikita'],
  ['export-csv', 'maria'],
  ['roadmap-priority', 'anna'],
  ['roadmap-priority', 'nikita'],
  ['roadmap-priority', 'sergey'],
  ['webhooks', 'nikita'],
  ['webhooks', 'maria'],
  ['public-changelog', 'anna'],
  ['public-changelog', 'olga'],
  ['telegram-notify', 'sergey'],
  ['telegram-notify', 'maria'],
  ['inline-like', 'anna'],
  ['inline-like', 'nikita'],
  ['inline-like', 'olga'],
];

const IDEA_COMMENTS = [
  ['dark-theme', 'maria', 'Для встраивания на тёмные сайты это будет прям must-have.'],
  ['dark-theme', 'sergey', 'Если сделаем тему через CSS-переменные, поддержку будет проще расширять.'],
  ['release-subscription', 'anna', 'Подписка особенно полезна для тех, кто голосует и потом теряет идею из поля зрения.'],
  ['export-csv', 'olga', 'CSV нужен для презентаций и чтобы можно было быстро собрать отчёт для команды.'],
  ['roadmap-priority', 'nikita', 'Ручная сортировка карточек roadmap точно пригодится менеджеру во время подготовки релиза.'],
  ['webhooks', 'sergey', 'Webhook хорошо ляжет на интеграцию с Slack, Telegram и внутренними системами.'],
  ['public-changelog', 'anna', 'Changelog рядом с roadmap сделает платформу законченнее и полезнее для пользователей.'],
  ['telegram-notify', 'maria', 'Я бы подписалась на такие уведомления как менеджер, чтобы быстро реагировать на обсуждения.'],
  ['inline-like', 'anna', 'Ставить лайк прямо в карточке гораздо быстрее, чем открывать детали каждой идеи.'],
];

const APP_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(APP_DIR, 'dist');

const ensureEnvLoaded = () => {
  dotenv.config({ path: path.join(APP_DIR, '.env') });
};

const ensureDistExists = () => {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(
      'Не найден backend/dist. Сначала выполните: cd backend && npm run build'
    );
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

const getAuthenticatedRoleId = async (strapi) => {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
    select: ['id'],
  });

  if (!role?.id) {
    throw new Error('Не найдена роль authenticated в users-permissions.');
  }

  return role.id;
};

const getFingerprintByUser = (user) => `actor:user:${user.id}`;

const upsertDemoUser = async (strapi, roleId, definition) => {
  const userService = strapi.plugin('users-permissions').service('user');
  const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { email: definition.email },
    populate: ['role'],
  });

  if (!existing) {
    const created = await userService.add({
      username: definition.username,
      email: definition.email,
      password: DEMO_PASSWORD,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: roleId,
    });

    return { user: created, created: true };
  }

  const updated = await userService.edit(existing.id, {
    username: definition.username,
    password: DEMO_PASSWORD,
    confirmed: true,
    blocked: false,
    role: roleId,
  });

  return { user: updated, created: false };
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

const ensureIdea = async (strapi, definition, authorFingerprint) => {
  const existing = await strapi.db.query('api::idea.idea').findOne({
    where: { title: definition.title },
  });

  if (existing) {
    return { entry: existing, created: false };
  }

  const created = await strapi.db.query('api::idea.idea').create({
    data: {
      title: definition.title,
      description: definition.description,
      status: definition.status,
      votesCount: 0,
      authorFingerprint,
      isHidden: false,
    },
  });

  return { entry: created, created: true };
};

const ensureIdeaVote = async (strapi, idea, userFingerprint) => {
  const existing = await strapi.db.query('api::vote.vote').findOne({
    where: {
      ideaDocumentId: idea.documentId,
      userFingerprint,
    },
  });

  if (existing) {
    return false;
  }

  await strapi.db.query('api::vote.vote').create({
    data: {
      idea: idea.id,
      ideaDocumentId: idea.documentId,
      userFingerprint,
    },
  });

  return true;
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

const ensureIdeaComment = async (strapi, idea, userFingerprint, text) => {
  const candidates = await strapi.db.query('api::comment.comment').findMany({
    where: { text, userFingerprint },
    populate: {
      idea: {
        select: ['id'],
      },
    },
  });

  const exists = candidates.some((comment) => comment.idea?.id === idea.id);
  if (exists) {
    return false;
  }

  await strapi.db.query('api::comment.comment').create({
    data: {
      idea: idea.id,
      text,
      userFingerprint,
      isHidden: false,
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

const syncIdeaVotesCount = async (strapi, idea) => {
  const votesCount = await strapi.db.query('api::vote.vote').count({
    where: {
      ideaDocumentId: idea.documentId,
    },
  });

  await strapi.db.query('api::idea.idea').update({
    where: { id: idea.id },
    data: { votesCount },
  });
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
    const roleId = await getAuthenticatedRoleId(strapi);
    const userByKey = new Map();
    const roadmapByKey = new Map();
    const ideaByKey = new Map();

    const stats = {
      usersCreated: 0,
      usersUpdated: 0,
      roadmapCreated: 0,
      ideasCreated: 0,
      roadmapVotesCreated: 0,
      roadmapCommentsCreated: 0,
      ideaVotesCreated: 0,
      ideaCommentsCreated: 0,
    };

    for (const definition of DEMO_USERS) {
      const result = await upsertDemoUser(strapi, roleId, definition);
      userByKey.set(definition.key, result.user);
      if (result.created) {
        stats.usersCreated += 1;
      } else {
        stats.usersUpdated += 1;
      }
    }

    for (const definition of ROADMAP_ITEMS) {
      const result = await ensureRoadmapItem(strapi, definition);
      roadmapByKey.set(definition.key, result.entry);
      if (result.created) {
        stats.roadmapCreated += 1;
      }
    }

    for (const definition of IDEAS) {
      const author = userByKey.get(definition.author);
      const authorFingerprint = getFingerprintByUser(author);
      const result = await ensureIdea(strapi, definition, authorFingerprint);
      ideaByKey.set(definition.key, result.entry);
      if (result.created) {
        stats.ideasCreated += 1;
      }
    }

    for (const [roadmapKey, userKey] of ROADMAP_VOTES) {
      const roadmapItem = roadmapByKey.get(roadmapKey);
      const user = userByKey.get(userKey);
      const created = await ensureRoadmapVote(strapi, roadmapItem, getFingerprintByUser(user));
      if (created) {
        stats.roadmapVotesCreated += 1;
      }
    }

    for (const [roadmapKey, userKey, text] of ROADMAP_COMMENTS) {
      const roadmapItem = roadmapByKey.get(roadmapKey);
      const user = userByKey.get(userKey);
      const created = await ensureRoadmapComment(strapi, roadmapItem, getFingerprintByUser(user), text);
      if (created) {
        stats.roadmapCommentsCreated += 1;
      }
    }

    for (const [ideaKey, userKey] of IDEA_VOTES) {
      const idea = ideaByKey.get(ideaKey);
      const user = userByKey.get(userKey);
      const created = await ensureIdeaVote(strapi, idea, getFingerprintByUser(user));
      if (created) {
        stats.ideaVotesCreated += 1;
      }
    }

    for (const [ideaKey, userKey, text] of IDEA_COMMENTS) {
      const idea = ideaByKey.get(ideaKey);
      const user = userByKey.get(userKey);
      const created = await ensureIdeaComment(strapi, idea, getFingerprintByUser(user), text);
      if (created) {
        stats.ideaCommentsCreated += 1;
      }
    }

    for (const idea of ideaByKey.values()) {
      await syncIdeaVotesCount(strapi, idea);
    }

    for (const roadmapItem of roadmapByKey.values()) {
      await syncRoadmapCounts(strapi, roadmapItem);
    }

    console.log('Демо-данные успешно подготовлены.');
    console.log(JSON.stringify(stats, null, 2));
    console.log('');
    console.log('Демо-пользователи для входа в виджет:');
    for (const user of DEMO_USERS) {
      console.log(`- ${user.email} / ${DEMO_PASSWORD}`);
    }
  } finally {
    await strapi.destroy();
  }
};

main().catch((error) => {
  console.error('Не удалось подготовить demo-данные.');
  console.error(error);
  process.exit(1);
});

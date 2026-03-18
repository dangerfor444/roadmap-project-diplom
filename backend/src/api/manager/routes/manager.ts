export default {
  routes: [
    {
      method: 'GET',
      path: '/manager/roadmap',
      handler: 'manager.listRoadmap',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'POST',
      path: '/manager/roadmap',
      handler: 'manager.createRoadmap',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'PUT',
      path: '/manager/roadmap/:id',
      handler: 'manager.updateRoadmap',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'DELETE',
      path: '/manager/roadmap/:id',
      handler: 'manager.deleteRoadmap',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'GET',
      path: '/manager/ideas',
      handler: 'manager.listIdeas',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'PATCH',
      path: '/manager/ideas/:id/status',
      handler: 'manager.updateIdeaStatus',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'DELETE',
      path: '/manager/ideas/:id',
      handler: 'manager.deleteIdea',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'GET',
      path: '/manager/comments',
      handler: 'manager.listComments',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'PATCH',
      path: '/manager/comments/:target/:id/moderate',
      handler: 'manager.moderateComment',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
    {
      method: 'DELETE',
      path: '/manager/comments/:target/:id',
      handler: 'manager.deleteComment',
      config: {
        auth: false,
        middlewares: ['global::manager-api-key'],
      },
    },
  ],
};

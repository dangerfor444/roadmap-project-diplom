export default {
  routes: [
    {
      method: 'POST',
      path: '/public/auth/actor-token',
      handler: 'public.issueActorToken',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/public/roadmap',
      handler: 'public.roadmap',
      config: {},
    },
    {
      method: 'GET',
      path: '/public/roadmap/:id',
      handler: 'public.roadmapItem',
      config: {},
    },
    {
      method: 'POST',
      path: '/public/roadmap/:id/vote',
      handler: 'public.roadmapVote',
      config: {},
    },
    {
      method: 'DELETE',
      path: '/public/roadmap/:id/vote',
      handler: 'public.roadmapUnvote',
      config: {},
    },
    {
      method: 'POST',
      path: '/public/roadmap/:id/comments',
      handler: 'public.roadmapComment',
      config: {},
    },
    {
      method: 'GET',
      path: '/public/ideas',
      handler: 'public.ideas',
      config: {},
    },
    {
      method: 'GET',
      path: '/public/ideas/:id',
      handler: 'public.idea',
      config: {},
    },
    {
      method: 'POST',
      path: '/public/ideas',
      handler: 'public.createIdea',
      config: {},
    },
    {
      method: 'POST',
      path: '/public/ideas/:id/vote',
      handler: 'public.vote',
      config: {},
    },
    {
      method: 'DELETE',
      path: '/public/ideas/:id/vote',
      handler: 'public.unvote',
      config: {},
    },
    {
      method: 'POST',
      path: '/public/ideas/:id/comments',
      handler: 'public.comment',
      config: {},
    },
  ],
};

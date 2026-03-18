import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      frameguard: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'frame-ancestors': ["'self'", env('EMBED_ALLOWED_ORIGIN', '*')],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [env('FRONTEND_ORIGIN', 'http://localhost:5173')],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'X-Actor-Id',
        'x-actor-id',
        'X-User-Id',
        'x-user-id',
        'X-Actor-Token',
        'x-actor-token',
        'X-Manager-Key',
        'x-manager-key',
      ],
      credentials: true,
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'global::public-write-rate-limit',
  'strapi::session',
  'strapi::favicon',
  'global::app-spa-fallback',
  'strapi::public',
];

export default config;

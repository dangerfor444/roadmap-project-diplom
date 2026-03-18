import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { Core } from '@strapi/strapi';

type KoaContext = {
  method: string;
  path: string;
  status: number;
  type?: string;
  body?: unknown;
};

const HAS_EXTENSION = /\.[A-Za-z0-9]+$/;

const isSpaRoute = (requestPath: string): boolean => {
  if (!requestPath.startsWith('/app')) {
    return false;
  }

  if (requestPath.startsWith('/app/assets/')) {
    return false;
  }

  if (HAS_EXTENSION.test(requestPath)) {
    return false;
  }

  return true;
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const indexPath = path.join(strapi.dirs.app.root, 'public', 'app', 'index.html');

  return async (ctx: KoaContext, next: () => Promise<unknown>) => {
    if ((ctx.method === 'GET' || ctx.method === 'HEAD') && isSpaRoute(ctx.path) && existsSync(indexPath)) {
      ctx.status = 200;
      ctx.type = 'text/html; charset=utf-8';
      if (ctx.method === 'GET') {
        ctx.body = createReadStream(indexPath);
      }
      return;
    }

    await next();
  };
};

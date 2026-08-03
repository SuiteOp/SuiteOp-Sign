import type { TrpcRouteMeta } from './trpc';

export const allowsApiTokenAuth = (meta: TrpcRouteMeta | undefined): boolean =>
  Boolean(meta?.openapi?.path || meta?.apiTokenAuth);

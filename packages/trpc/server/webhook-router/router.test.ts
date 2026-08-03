import { describe, expect, it } from 'vitest';

import { allowsApiTokenAuth } from '../api-token-auth';
import type { TrpcRouteMeta } from '../trpc';
import { webhookRouter } from './router';

describe('webhookRouter API-token access', () => {
  it.each(['getTeamWebhooks', 'createWebhook', 'deleteWebhook'] as const)('keeps %s session-only', (procedureName) => {
    const procedure = webhookRouter._def.procedures[procedureName];
    const meta = procedure?._def.meta as TrpcRouteMeta | undefined;

    expect(allowsApiTokenAuth(meta)).toBe(false);
  });
});

import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_WEBHOOK_EVENTS, GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { claimAuthorization } from './claim-authorization';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    suiteOpAuthorization: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('claimAuthorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces stale SuiteOp webhooks and returns exact remote resource ownership', async () => {
    const callOrder: string[] = [];
    const update = vi.fn(() => {
      callOrder.push('authorization.update');
      return Promise.resolve();
    });
    const deleteMany = vi.fn(() => {
      callOrder.push('webhook.deleteMany');
      return Promise.resolve({ count: 2 });
    });
    const create = vi.fn(() => {
      callOrder.push('webhook.create');
      return Promise.resolve({
        id: 'webhook-new',
        webhookUrl: GLOBAL_WEBHOOK_URL,
        eventTriggers: [...GLOBAL_WEBHOOK_EVENTS],
      });
    });

    vi.mocked(prisma.suiteOpAuthorization.findUnique).mockResolvedValue({
      id: 11,
      claimCode: 'claim-code',
      claimed: false,
      expiresAt: new Date(Date.now() + 60_000),
      plaintextToken: 'api-token-plaintext',
      userId: 7,
      teamId: 3,
      apiTokenId: 19,
      createdAt: new Date(),
      team: { id: 3, name: 'Personal Team' },
      apiToken: { id: 19, token: 'hashed-token' },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        suiteOpAuthorization: { update },
        webhook: { deleteMany, create },
      } as never),
    );

    await expect(claimAuthorization({ claimCode: 'claim-code' })).resolves.toEqual({
      token: 'api-token-plaintext',
      apiTokenId: 19,
      teamId: 3,
      teamName: 'Personal Team',
      webhook: {
        id: 'webhook-new',
        webhookUrl: GLOBAL_WEBHOOK_URL,
        eventTriggers: [...GLOBAL_WEBHOOK_EVENTS],
      },
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        teamId: 3,
        webhookUrl: GLOBAL_WEBHOOK_URL,
      },
    });
    expect(callOrder).toEqual(['authorization.update', 'webhook.deleteMany', 'webhook.create']);
  });
});

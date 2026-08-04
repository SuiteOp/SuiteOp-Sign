import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { AppErrorCode } from '../../errors/app-error';
import { deleteTokenById } from './delete-api-token-by-id';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

type AuthorizationRow = { webhookId: string | null } | null;

const runTransaction = (authorization: AuthorizationRow, remainingAuthorizations = 0) => {
  const calls: string[] = [];
  const tx = {
    apiToken: {
      delete: vi.fn(() => {
        calls.push('apiToken.delete');
        return Promise.resolve();
      }),
    },
    suiteOpAuthorization: {
      findFirst: vi.fn(() => {
        calls.push('authorization.findFirst');
        return Promise.resolve(authorization);
      }),
      count: vi.fn().mockResolvedValue(remainingAuthorizations),
    },
    webhook: {
      findFirst: vi.fn().mockResolvedValue({
        webhookUrl: 'https://api-eu.suiteop.com/api/webhooks/documenso/url-token',
      }),
      deleteMany: vi.fn(() => {
        calls.push('webhook.deleteMany');
        return Promise.resolve({ count: 1 });
      }),
    },
  };

  vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof tx) => Promise<unknown>) =>
    callback(tx)) as never);

  return { tx, calls };
};

describe('deleteTokenById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.team.findFirst).mockResolvedValue({ id: 7 } as never);
  });

  // SuiteOp disconnects by deleting the token it was issued. Webhook CRUD is
  // session-only, so if the token deletion does not take the webhook with it,
  // the team keeps POSTing document events to a disconnected integration.
  it('removes the recorded webhook in the same transaction as the token', async () => {
    const { tx, calls } = runTransaction({ webhookId: 'webhook-regional' });

    await deleteTokenById({ id: 19, userId: 3, teamId: 7 });

    expect(tx.apiToken.delete).toHaveBeenCalledWith({ where: { id: 19, teamId: 7 } });
    expect(tx.webhook.deleteMany).toHaveBeenCalledWith({
      where: { id: 'webhook-regional', teamId: 7 },
    });
    // The authorization row cascades away with its token, so the webhook it
    // names is only readable before the delete.
    expect(calls).toEqual(['authorization.findFirst', 'apiToken.delete', 'webhook.deleteMany']);
  });

  it('falls back to the global webhook for an authorization that recorded none', async () => {
    const { tx } = runTransaction({ webhookId: null }, 0);

    await deleteTokenById({ id: 19, userId: 3, teamId: 7 });

    expect(tx.webhook.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 7, webhookUrl: GLOBAL_WEBHOOK_URL },
    });
  });

  it('touches no webhook when the token is not a SuiteOp integration token', async () => {
    const { tx } = runTransaction(null);

    await deleteTokenById({ id: 19, userId: 3, teamId: 7 });

    expect(tx.apiToken.delete).toHaveBeenCalled();
    expect(tx.webhook.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes nothing when the caller cannot manage the team', async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue(null);

    await expect(deleteTokenById({ id: 19, userId: 3, teamId: 7 })).rejects.toMatchObject({
      code: AppErrorCode.UNAUTHORIZED,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

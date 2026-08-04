import { prisma } from '@documenso/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_WEBHOOK_EVENTS, GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { AppErrorCode } from '../../errors/app-error';
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

  it('rejects an unknown claim code before starting a transaction', async () => {
    vi.mocked(prisma.suiteOpAuthorization.findUnique).mockResolvedValue(null);

    await expect(claimAuthorization({ claimCode: 'missing' })).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an already-claimed code before starting a transaction', async () => {
    vi.mocked(prisma.suiteOpAuthorization.findUnique).mockResolvedValue({
      claimed: true,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    await expect(claimAuthorization({ claimCode: 'claimed' })).rejects.toMatchObject({
      code: AppErrorCode.ALREADY_EXISTS,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an expired code before starting a transaction', async () => {
    vi.mocked(prisma.suiteOpAuthorization.findUnique).mockResolvedValue({
      claimed: false,
      expiresAt: new Date(Date.now() - 60_000),
    } as never);

    await expect(claimAuthorization({ claimCode: 'expired' })).rejects.toMatchObject({
      code: AppErrorCode.EXPIRED_CODE,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    } as never);
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
        webhookUrl: { in: [GLOBAL_WEBHOOK_URL] },
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: 11,
      },
      data: {
        claimed: true,
        plaintextToken: '',
        webhookId: 'webhook-new',
      },
    });
    // The webhook has to exist before the authorization can record its id.
    expect(callOrder).toEqual(['webhook.deleteMany', 'webhook.create', 'authorization.update']);
  });

  // SuiteOp's regional API is the only address that reaches the platform; the
  // global webhook goes to the legacy app. Registering the regional endpoint at
  // claim time is what replaced bearer-token `webhook.createWebhook`.
  it('registers the SuiteOp-supplied regional endpoint and retires the global one', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const regionalUrl = 'https://api-eu.suiteop.com/api/webhooks/documenso/url-token';
    const create = vi.fn().mockResolvedValue({
      id: 'webhook-regional',
      webhookUrl: regionalUrl,
      eventTriggers: [...GLOBAL_WEBHOOK_EVENTS],
    });

    vi.mocked(prisma.suiteOpAuthorization.findUnique).mockResolvedValue({
      id: 11,
      claimed: false,
      expiresAt: new Date(Date.now() + 60_000),
      plaintextToken: 'api-token-plaintext',
      userId: 7,
      teamId: 3,
      team: { id: 3, name: 'Personal Team' },
      apiToken: { id: 19, token: 'hashed-token' },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        suiteOpAuthorization: { update },
        webhook: { deleteMany, create },
      } as never),
    );

    const result = await claimAuthorization({
      claimCode: 'claim-code',
      webhookUrl: regionalUrl,
    });

    expect(result.webhook.webhookUrl).toBe(regionalUrl);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ webhookUrl: regionalUrl }) }),
    );
    // Both addresses are cleared, so the team never double-delivers.
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        teamId: 3,
        webhookUrl: { in: [regionalUrl, GLOBAL_WEBHOOK_URL] },
      },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ webhookId: 'webhook-regional' }) }),
    );
  });

  // A rejected URL must not burn the claim code — the operator would have to
  // restart the entire OAuth flow to retry.
  it('rejects a non-SuiteOp webhook URL without consuming the claim', async () => {
    vi.mocked(prisma.suiteOpAuthorization.findUnique).mockResolvedValue({
      claimed: false,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    await expect(
      claimAuthorization({ claimCode: 'claim-code', webhookUrl: 'https://attacker.example.com/hook' }),
    ).rejects.toMatchObject({ code: AppErrorCode.INVALID_BODY });
    expect(prisma.suiteOpAuthorization.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { deleteSuiteOpWebhookForToken, readSuiteOpTokenWebhook } from './delete-orphaned-webhook';

const REGIONAL_URL = 'https://api-eu.suiteop.com/api/webhooks/documenso/url-token';

const createTx = (
  remainingAuthorizations = 0,
  authorization: { webhookId: string | null } | null = null,
  webhook: { webhookUrl: string } | null = { webhookUrl: REGIONAL_URL },
) => ({
  suiteOpAuthorization: {
    count: vi.fn().mockResolvedValue(remainingAuthorizations),
    findFirst: vi.fn().mockResolvedValue(authorization),
  },
  webhook: {
    findFirst: vi.fn().mockResolvedValue(webhook),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
});

describe('readSuiteOpTokenWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the recorded webhook for a SuiteOp token', async () => {
    const tx = createTx(0, { webhookId: 'webhook-regional' });

    await expect(readSuiteOpTokenWebhook({ tx: tx as never, apiTokenId: 19 })).resolves.toEqual({
      webhookId: 'webhook-regional',
    });
    expect(tx.suiteOpAuthorization.findFirst).toHaveBeenCalledWith({
      where: { apiTokenId: 19 },
      select: { webhookId: true },
    });
  });

  it('returns null for a token that is not a SuiteOp integration token', async () => {
    const tx = createTx(0, null);

    await expect(readSuiteOpTokenWebhook({ tx: tx as never, apiTokenId: 19 })).resolves.toBeNull();
  });
});

describe('deleteSuiteOpWebhookForToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes exactly the recorded webhook, scoped to the team', async () => {
    const tx = createTx();

    await deleteSuiteOpWebhookForToken({ tx: tx as never, teamId: 7, webhookId: 'webhook-regional' });

    expect(tx.webhook.deleteMany).toHaveBeenCalledWith({
      where: { id: 'webhook-regional', teamId: 7 },
    });
    // A regional endpoint belongs to one integration — no survivor count needed.
    expect(tx.suiteOpAuthorization.count).not.toHaveBeenCalled();
  });

  // The global address is one row per team, shared by every integration on it
  // and by the legacy app behind it. Revoking one token must not silence the
  // rest, even though this authorization recorded that row as its own.
  it('keeps a recorded global webhook while another SuiteOp integration remains', async () => {
    const tx = createTx(1, null, { webhookUrl: GLOBAL_WEBHOOK_URL });

    await deleteSuiteOpWebhookForToken({ tx: tx as never, teamId: 7, webhookId: 'webhook-global' });

    expect(tx.webhook.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a recorded global webhook once it is the last integration', async () => {
    const tx = createTx(0, null, { webhookUrl: GLOBAL_WEBHOOK_URL });

    await deleteSuiteOpWebhookForToken({ tx: tx as never, teamId: 7, webhookId: 'webhook-global' });

    expect(tx.webhook.deleteMany).toHaveBeenCalledWith({
      where: { id: 'webhook-global', teamId: 7 },
    });
  });

  it('does nothing when the recorded webhook is already gone', async () => {
    const tx = createTx(0, null, null);

    await deleteSuiteOpWebhookForToken({ tx: tx as never, teamId: 7, webhookId: 'webhook-missing' });

    expect(tx.webhook.deleteMany).not.toHaveBeenCalled();
  });

  // Authorizations claimed before webhooks were recorded are all on the shared
  // global URL, which a team's other integrations may still need.
  it('falls back to the global webhook once no claimed authorization is left', async () => {
    const tx = createTx(0);

    await deleteSuiteOpWebhookForToken({ tx: tx as never, teamId: 7, webhookId: null });

    expect(tx.webhook.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 7, webhookUrl: GLOBAL_WEBHOOK_URL },
    });
  });

  it('keeps the shared global webhook while another claimed authorization survives', async () => {
    const tx = createTx(1);

    await deleteSuiteOpWebhookForToken({ tx: tx as never, teamId: 7, webhookId: null });

    expect(tx.webhook.deleteMany).not.toHaveBeenCalled();
  });
});

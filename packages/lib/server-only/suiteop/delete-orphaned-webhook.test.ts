import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { deleteOrphanedSuiteOpWebhook } from './delete-orphaned-webhook';

const createTx = (remainingAuthorizations: number) => ({
  suiteOpAuthorization: {
    count: vi.fn().mockResolvedValue(remainingAuthorizations),
  },
  webhook: {
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
});

describe('deleteOrphanedSuiteOpWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the SuiteOp webhook once the team has no claimed authorization left', async () => {
    const tx = createTx(0);

    await deleteOrphanedSuiteOpWebhook({ tx: tx as never, teamId: 7 });

    expect(tx.suiteOpAuthorization.count).toHaveBeenCalledWith({
      where: { teamId: 7, claimed: true },
    });
    expect(tx.webhook.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 7, webhookUrl: GLOBAL_WEBHOOK_URL },
    });
  });

  // The claim flow keeps exactly one webhook per team, so a team that still has
  // a live SuiteOp connection must keep receiving events.
  it('keeps the webhook while another claimed authorization survives', async () => {
    const tx = createTx(1);

    await deleteOrphanedSuiteOpWebhook({ tx: tx as never, teamId: 7 });

    expect(tx.webhook.deleteMany).not.toHaveBeenCalled();
  });

  it('never touches webhooks belonging to another team', async () => {
    const tx = createTx(0);

    await deleteOrphanedSuiteOpWebhook({ tx: tx as never, teamId: 42 });

    expect(tx.webhook.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teamId: 42 }) }),
    );
  });
});

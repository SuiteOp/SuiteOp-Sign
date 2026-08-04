import type { Prisma } from '@prisma/client';

import { GLOBAL_WEBHOOK_URL } from '../../constants/app';

export type DeleteOrphanedSuiteOpWebhookOptions = {
  tx: Prisma.TransactionClient;
  teamId: number;
};

/**
 * Drop the SuiteOp-managed webhook once a team has no SuiteOp integration left.
 *
 * `claimAuthorization` creates the webhook server-side, atomically with the API
 * token it hands to SuiteOp, so SuiteOp never owns it. SuiteOp disconnects by
 * deleting that token, and webhook CRUD is session-only — without this the
 * webhook outlives the disconnect and keeps POSTing the team's document events
 * to SuiteOp forever.
 *
 * Must run inside the token-deletion transaction: the `SuiteOpAuthorization`
 * row cascades away with its API token, and what remains afterwards is exactly
 * what decides whether the team still needs the webhook. A team with another
 * claimed authorization keeps it — the claim flow deliberately shares one
 * webhook per team.
 */
export const deleteOrphanedSuiteOpWebhook = async ({ tx, teamId }: DeleteOrphanedSuiteOpWebhookOptions) => {
  const remainingAuthorizations = await tx.suiteOpAuthorization.count({
    where: {
      teamId,
      claimed: true,
    },
  });

  if (remainingAuthorizations > 0) {
    return;
  }

  // Matched by URL, the same way the claim flow identifies its own webhook.
  await tx.webhook.deleteMany({
    where: {
      teamId,
      webhookUrl: GLOBAL_WEBHOOK_URL,
    },
  });
};

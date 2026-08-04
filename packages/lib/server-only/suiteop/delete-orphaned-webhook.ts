import type { Prisma } from '@prisma/client';

import { GLOBAL_WEBHOOK_URL } from '../../constants/app';

export type ReadSuiteOpTokenWebhookOptions = {
  tx: Prisma.TransactionClient;
  apiTokenId: number;
};

export type DeleteSuiteOpWebhookForTokenOptions = {
  tx: Prisma.TransactionClient;
  teamId: number;
  /** Webhook recorded on the authorization, read before the token was deleted. */
  webhookId: string | null;
};

/**
 * Read the webhook this API token's authorization owns, before the token goes.
 *
 * Deleting an `ApiToken` cascades its `SuiteOpAuthorization` row away, taking
 * `webhookId` with it — so this has to happen first, in the same transaction.
 * Returns null when the token is not a SuiteOp integration token.
 */
export const readSuiteOpTokenWebhook = async ({ tx, apiTokenId }: ReadSuiteOpTokenWebhookOptions) => {
  const authorization = await tx.suiteOpAuthorization.findFirst({
    where: {
      apiTokenId,
    },
    select: {
      webhookId: true,
    },
  });

  return authorization ? { webhookId: authorization.webhookId } : null;
};

/**
 * Drop the webhook created for a SuiteOp integration whose token was revoked.
 *
 * The webhook is ours, not SuiteOp's: the claim creates it server-side and
 * SuiteOp cannot delete it, because webhook CRUD is session-only. Without this
 * it outlives the disconnect and keeps POSTing the team's document events to an
 * integration that no longer exists.
 *
 * Authorizations claimed before webhooks were recorded have no `webhookId`.
 * Those are all on the shared global URL, so they fall back to deleting it —
 * but only once no claimed authorization is left, since that webhook is shared
 * across a team's integrations.
 */
export const deleteSuiteOpWebhookForToken = async ({ tx, teamId, webhookId }: DeleteSuiteOpWebhookForTokenOptions) => {
  if (webhookId) {
    await tx.webhook.deleteMany({
      where: {
        id: webhookId,
        teamId,
      },
    });

    return;
  }

  const remainingAuthorizations = await tx.suiteOpAuthorization.count({
    where: {
      teamId,
      claimed: true,
    },
  });

  if (remainingAuthorizations > 0) {
    return;
  }

  await tx.webhook.deleteMany({
    where: {
      teamId,
      webhookUrl: GLOBAL_WEBHOOK_URL,
    },
  });
};

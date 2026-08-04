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
 * The global webhook is the exception: it is one row per team, shared by every
 * SuiteOp integration on it and by the legacy app behind that address. Revoking
 * one token must not silence the others, so it only goes when no claimed
 * authorization is left — and then it goes by URL rather than by recorded id,
 * because the surviving row may have been recorded by a sibling authorization,
 * or by one claimed before `webhookId` existed and so recorded nothing at all.
 */
export const deleteSuiteOpWebhookForToken = async ({ tx, teamId, webhookId }: DeleteSuiteOpWebhookForTokenOptions) => {
  // Runs after the token's cascade, so the revoked authorization is already
  // gone and cannot count itself as a survivor.
  const isLastSuiteOpIntegration =
    (await tx.suiteOpAuthorization.count({
      where: {
        teamId,
        claimed: true,
      },
    })) === 0;

  if (webhookId) {
    const webhook = await tx.webhook.findFirst({
      where: {
        id: webhookId,
        teamId,
      },
      select: {
        webhookUrl: true,
      },
    });

    // A regional endpoint belongs to exactly one integration, so it goes with
    // it. The global address is shared and is only ever removed by the sweep
    // below, whichever authorization happened to record it.
    if (webhook && webhook.webhookUrl !== GLOBAL_WEBHOOK_URL) {
      await tx.webhook.deleteMany({
        where: {
          id: webhookId,
          teamId,
        },
      });
    }
  }

  if (!isLastSuiteOpIntegration) {
    return;
  }

  await tx.webhook.deleteMany({
    where: {
      teamId,
      webhookUrl: GLOBAL_WEBHOOK_URL,
    },
  });
};

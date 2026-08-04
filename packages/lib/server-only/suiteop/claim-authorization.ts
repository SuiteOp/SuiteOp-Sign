import { prisma } from '@documenso/prisma';

import { GLOBAL_WEBHOOK_EVENTS, GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { assertAllowedSuiteOpWebhookUrl } from './assert-allowed-webhook-url';

export type ClaimAuthorizationOptions = {
  claimCode: string;
  /**
   * Regional SuiteOp endpoint to deliver this team's document events to. When
   * omitted the shared global webhook is used, which is what SuiteOp
   * deployments that cannot be reached from here (local development) rely on.
   */
  webhookUrl?: string;
};

export const claimAuthorization = async ({ claimCode, webhookUrl }: ClaimAuthorizationOptions) => {
  // Validate before touching the authorization: a bad URL must not consume the
  // claim code, or the operator has to restart the whole OAuth flow to retry.
  const targetWebhookUrl = webhookUrl ? assertAllowedSuiteOpWebhookUrl(webhookUrl) : GLOBAL_WEBHOOK_URL;

  const authorization = await prisma.suiteOpAuthorization.findUnique({
    where: {
      claimCode,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      apiToken: {
        select: {
          id: true,
          token: true,
        },
      },
    },
  });

  if (!authorization) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invalid claim code',
    });
  }

  if (authorization.claimed) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'Claim code has already been used',
    });
  }

  if (authorization.expiresAt < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Claim code has expired',
    });
  }

  // Mark as claimed and clear plaintext token, and create webhook in a transaction
  const webhook = await prisma.$transaction(async (tx) => {
    // A team can reconnect after an interrupted callback. Keep exactly one
    // SuiteOp-managed webhook per address instead of accumulating duplicates,
    // and when SuiteOp supplies its own regional endpoint, retire the global
    // one — two live subscriptions would double-deliver every event.
    await tx.webhook.deleteMany({
      where: {
        teamId: authorization.teamId,
        webhookUrl: { in: [...new Set([targetWebhookUrl, GLOBAL_WEBHOOK_URL])] },
      },
    });

    // Create a webhook so SuiteOp receives document events for this team.
    const created = await tx.webhook.create({
      data: {
        webhookUrl: targetWebhookUrl,
        eventTriggers: [...GLOBAL_WEBHOOK_EVENTS],
        secret: null,
        enabled: true,
        userId: authorization.userId,
        teamId: authorization.teamId,
      },
      select: {
        id: true,
        webhookUrl: true,
        eventTriggers: true,
      },
    });

    // Recording the webhook here is what lets revoking this token take the
    // webhook with it — see `deleteSuiteOpWebhookForToken`.
    await tx.suiteOpAuthorization.update({
      where: {
        id: authorization.id,
      },
      data: {
        claimed: true,
        plaintextToken: '',
        webhookId: created.id,
      },
    });

    return created;
  });

  return {
    token: authorization.plaintextToken,
    apiTokenId: authorization.apiToken.id,
    teamId: authorization.team.id,
    teamName: authorization.team.name,
    webhook,
  };
};

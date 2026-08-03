import { prisma } from '@documenso/prisma';

import { GLOBAL_WEBHOOK_EVENTS, GLOBAL_WEBHOOK_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';

export type ClaimAuthorizationOptions = {
  claimCode: string;
};

export const claimAuthorization = async ({ claimCode }: ClaimAuthorizationOptions) => {
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
    await tx.suiteOpAuthorization.update({
      where: {
        id: authorization.id,
      },
      data: {
        claimed: true,
        plaintextToken: '',
      },
    });

    // A team can reconnect after an interrupted callback. Keep exactly one
    // SuiteOp-managed global webhook instead of accumulating duplicates.
    await tx.webhook.deleteMany({
      where: {
        teamId: authorization.teamId,
        webhookUrl: GLOBAL_WEBHOOK_URL,
      },
    });

    // Create a webhook so SuiteOp receives document events for this team.
    return await tx.webhook.create({
      data: {
        webhookUrl: GLOBAL_WEBHOOK_URL,
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
  });

  return {
    token: authorization.plaintextToken,
    apiTokenId: authorization.apiToken.id,
    teamId: authorization.team.id,
    teamName: authorization.team.name,
    webhook,
  };
};

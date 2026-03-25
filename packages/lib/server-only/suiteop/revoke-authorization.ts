import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type RevokeAuthorizationOptions = {
  teamId: number;
};

/**
 * Revokes SuiteOp integration for a team:
 * 1. Finds all API tokens named "SuiteOp Integration" for the team
 * 2. Deletes them and their associated webhooks
 *
 * Authenticated via master key (same as claim-authorization).
 */
export const revokeAuthorization = async ({ teamId }: RevokeAuthorizationOptions) => {
  // Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Team ${teamId} not found`,
    });
  }

  // Find and delete SuiteOp Integration API tokens
  const tokensToDelete = await prisma.apiToken.findMany({
    where: {
      teamId,
      name: 'SuiteOp Integration',
    },
    select: { id: true },
  });

  let deletedTokens = 0;
  for (const token of tokensToDelete) {
    await prisma.apiToken.delete({ where: { id: token.id } });
    deletedTokens++;
  }

  // Delete webhooks pointing to SuiteOp's hookdeck
  const webhooksToDelete = await prisma.webhook.findMany({
    where: {
      teamId,
      webhookUrl: { contains: 'events.suiteop.com' },
    },
    select: { id: true },
  });

  let deletedWebhooks = 0;
  for (const wh of webhooksToDelete) {
    await prisma.webhook.delete({ where: { id: wh.id } });
    deletedWebhooks++;
  }

  return {
    deletedTokens,
    deletedWebhooks,
    teamId: team.id,
    teamName: team.name,
  };
};

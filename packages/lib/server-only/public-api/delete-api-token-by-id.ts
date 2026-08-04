import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { deleteSuiteOpWebhookForToken, readSuiteOpTokenWebhook } from '../suiteop/delete-orphaned-webhook';

export type DeleteTokenByIdOptions = {
  id: number;
  userId: number;
  teamId: number;
};

export const deleteTokenById = async ({ id, userId, teamId }: DeleteTokenByIdOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to delete this token',
    });
  }

  await prisma.$transaction(async (tx) => {
    // A SuiteOp integration is revoked by deleting the token it was issued.
    // The webhook created with that token has no other cleanup path, and the
    // row naming it cascades away with the token — so read it first.
    const suiteOpAuthorization = await readSuiteOpTokenWebhook({ tx, apiTokenId: id });

    await tx.apiToken.delete({
      where: {
        id,
        teamId,
      },
    });

    if (suiteOpAuthorization) {
      await deleteSuiteOpWebhookForToken({
        tx,
        teamId,
        webhookId: suiteOpAuthorization.webhookId,
      });
    }
  });
};

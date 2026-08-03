import { deleteTokenById } from '@documenso/lib/server-only/public-api/delete-api-token-by-id';

import { authenticatedProcedure } from '../trpc';
import { ZDeleteApiTokenRequestSchema, ZDeleteApiTokenResponseSchema } from './delete-api-token.types';
import { assertApiTokenTeamScope } from './delete-api-token-auth';

export const deleteApiTokenRoute = authenticatedProcedure
  .meta({ apiTokenAuth: true })
  .input(ZDeleteApiTokenRequestSchema)
  .output(ZDeleteApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, teamId } = input;

    assertApiTokenTeamScope({
      authenticatedTeamId: ctx.teamId,
      isApiTokenRequest: ctx.session === null,
      requestedTeamId: teamId,
    });

    ctx.logger.info({
      input: {
        id,
        teamId,
      },
    });

    await deleteTokenById({
      id,
      teamId,
      userId: ctx.user.id,
    });
  });

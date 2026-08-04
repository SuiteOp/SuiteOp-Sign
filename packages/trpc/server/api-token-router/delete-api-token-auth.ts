import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

type AssertApiTokenTeamScopeOptions = {
  authenticatedTeamId: number;
  /** The token that authenticated the request, or null for a session request. */
  authenticatedApiTokenId: number | null;
  isApiTokenRequest: boolean;
  requestedTeamId: number;
  requestedTokenId: number;
};

/**
 * Bound what a bearer token may delete: itself, and nothing else.
 *
 * A session legitimately spans every team its user belongs to and every token
 * in them, so it keeps supplying the team it is acting on. A token is issued
 * for exactly one team and exactly one integration, and the only revocation it
 * needs is its own disconnect — `getSuiteOpCode` and `getSuiteOpInfo` both hand
 * SuiteOp that id. Anything wider would let one leaked integration token
 * destroy every other integration's credentials on the same team, since
 * `deleteTokenById` authorizes against the token's owning manager user.
 */
export const assertApiTokenTeamScope = ({
  authenticatedTeamId,
  authenticatedApiTokenId,
  isApiTokenRequest,
  requestedTeamId,
  requestedTokenId,
}: AssertApiTokenTeamScopeOptions): void => {
  if (!isApiTokenRequest) {
    return;
  }

  if (requestedTeamId !== authenticatedTeamId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'API tokens can delete tokens only from their own team',
    });
  }

  if (requestedTokenId !== authenticatedApiTokenId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'API tokens can delete only themselves',
    });
  }
};

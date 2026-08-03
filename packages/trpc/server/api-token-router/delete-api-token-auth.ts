import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

type AssertApiTokenTeamScopeOptions = {
  authenticatedTeamId: number;
  isApiTokenRequest: boolean;
  requestedTeamId: number;
};

export const assertApiTokenTeamScope = ({
  authenticatedTeamId,
  isApiTokenRequest,
  requestedTeamId,
}: AssertApiTokenTeamScopeOptions): void => {
  if (isApiTokenRequest && requestedTeamId !== authenticatedTeamId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'API tokens can delete tokens only from their own team',
    });
  }
};

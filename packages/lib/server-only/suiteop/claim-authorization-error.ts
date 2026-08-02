import { AppError, AppErrorCode } from '../../errors/app-error';

type ClaimAuthorizationErrorResponse = {
  status: 400 | 404;
  body: { message: string };
};

export const getClaimAuthorizationErrorResponse = (error: unknown): ClaimAuthorizationErrorResponse | null => {
  if (!(error instanceof AppError)) {
    return null;
  }

  switch (error.code) {
    case AppErrorCode.EXPIRED_CODE:
    case AppErrorCode.ALREADY_EXISTS:
      return { status: 400, body: { message: error.message } };
    case AppErrorCode.NOT_FOUND:
      return { status: 404, body: { message: error.message } };
    default:
      return null;
  }
};

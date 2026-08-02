import { describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getClaimAuthorizationErrorResponse } from './claim-authorization-error';

describe('getClaimAuthorizationErrorResponse', () => {
  it.each([
    [AppErrorCode.EXPIRED_CODE, 'Claim code has expired', 400],
    [AppErrorCode.ALREADY_EXISTS, 'Claim code has already been used', 400],
    [AppErrorCode.NOT_FOUND, 'Invalid claim code', 404],
  ] as const)('maps %s to an API response', (code, message, status) => {
    expect(getClaimAuthorizationErrorResponse(new AppError(code, { message }))).toEqual({
      status,
      body: { message },
    });
  });

  it('leaves unexpected errors for the route error handler', () => {
    expect(getClaimAuthorizationErrorResponse(new Error('database unavailable'))).toBeNull();
  });
});

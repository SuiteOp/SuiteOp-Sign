import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { describe, expect, it } from 'vitest';

import { assertApiTokenTeamScope } from './delete-api-token-auth';

describe('assertApiTokenTeamScope', () => {
  it('allows an API token to act on its authenticated team', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        isApiTokenRequest: true,
        requestedTeamId: 3,
      }),
    ).not.toThrow();
  });

  it('rejects an API token that supplies a different team', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        isApiTokenRequest: true,
        requestedTeamId: 9,
      }),
    ).toThrow(expect.objectContaining({ code: AppErrorCode.UNAUTHORIZED }));
  });

  it('preserves session requests that select another accessible team', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        isApiTokenRequest: false,
        requestedTeamId: 9,
      }),
    ).not.toThrow();
  });
});

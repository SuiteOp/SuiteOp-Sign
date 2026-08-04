import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { describe, expect, it } from 'vitest';

import { assertApiTokenTeamScope } from './delete-api-token-auth';

describe('assertApiTokenTeamScope', () => {
  it('allows an API token to revoke itself', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        authenticatedApiTokenId: 19,
        isApiTokenRequest: true,
        requestedTeamId: 3,
        requestedTokenId: 19,
      }),
    ).not.toThrow();
  });

  it('rejects an API token that supplies a different team', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        authenticatedApiTokenId: 19,
        isApiTokenRequest: true,
        requestedTeamId: 9,
        requestedTokenId: 19,
      }),
    ).toThrow(expect.objectContaining({ code: AppErrorCode.UNAUTHORIZED }));
  });

  // The disconnect only ever revokes the calling integration. Team equality
  // alone would let one leaked token destroy every other integration's
  // credentials, because `deleteTokenById` authorizes against the token's
  // owning manager user rather than against the token.
  it('rejects an API token deleting a sibling token in its own team', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        authenticatedApiTokenId: 19,
        isApiTokenRequest: true,
        requestedTeamId: 3,
        requestedTokenId: 20,
      }),
    ).toThrow(expect.objectContaining({ code: AppErrorCode.UNAUTHORIZED }));
  });

  it('preserves session requests that select another accessible team', () => {
    expect(() =>
      assertApiTokenTeamScope({
        authenticatedTeamId: 3,
        authenticatedApiTokenId: null,
        isApiTokenRequest: false,
        requestedTeamId: 9,
        requestedTokenId: 20,
      }),
    ).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { allowsApiTokenAuth } from './api-token-auth';

describe('allowsApiTokenAuth', () => {
  it('allows API tokens for OpenAPI procedures', () => {
    expect(
      allowsApiTokenAuth({
        openapi: { method: 'GET', path: '/documents' },
      }),
    ).toBe(true);
  });

  it('allows API tokens for explicitly opted-in internal tRPC procedures', () => {
    expect(allowsApiTokenAuth({ apiTokenAuth: true })).toBe(true);
  });

  it('keeps session-only procedures closed to API tokens by default', () => {
    expect(allowsApiTokenAuth(undefined)).toBe(false);
    expect(allowsApiTokenAuth({})).toBe(false);
  });
});

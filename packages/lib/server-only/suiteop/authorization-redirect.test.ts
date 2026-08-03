import { describe, expect, it } from 'vitest';

import { createSuiteOpAuthorizationRedirect } from './authorization-redirect';

describe('createSuiteOpAuthorizationRedirect', () => {
  it('forces a document navigation to the SuiteOp callback', () => {
    const callbackUrl = new URL(
      'http://localhost:6901/oauth/callback/documenso?region=us&code=claim_test&state=state_test',
    );

    const response = createSuiteOpAuthorizationRedirect(callbackUrl);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(callbackUrl.toString());
    expect(response.headers.get('X-Remix-Reload-Document')).toBe('true');
  });
});

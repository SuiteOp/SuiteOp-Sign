import { describe, expect, it } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { assertAllowedSuiteOpWebhookUrl } from './assert-allowed-webhook-url';

describe('assertAllowedSuiteOpWebhookUrl', () => {
  it.each([
    'https://api-us.suiteop.com/api/webhooks/documenso/token',
    'https://api-eu-staging.suiteop.com/api/webhooks/documenso/token',
    'https://suiteop.com/api/webhooks/documenso/token',
    'https://suiteop-api-pr-9.up.railway.app/api/webhooks/documenso/token',
  ])('accepts the SuiteOp endpoint %s', (url) => {
    expect(assertAllowedSuiteOpWebhookUrl(url)).toBe(url);
  });

  it.each([
    // The capability that made bearer `webhook.createWebhook` unsafe: pointing
    // a team's document events at an arbitrary listener.
    ['an unrelated host', 'https://attacker.example.com/hook'],
    // Suffix matching must not be fooled by a lookalike registrable domain.
    ['a lookalike domain', 'https://evil-suiteop.com/hook'],
    ['a suffix-glued domain', 'https://notsuiteop.com/hook'],
    ['plaintext HTTP', 'http://api-us.suiteop.com/hook'],
    ['embedded credentials', 'https://user:pass@api-us.suiteop.com/hook'],
    ['a non-URL', 'not-a-url'],
  ])('rejects %s', (_case, url) => {
    expect(() => assertAllowedSuiteOpWebhookUrl(url)).toThrowError(
      expect.objectContaining({ code: AppErrorCode.INVALID_BODY }),
    );
  });
});

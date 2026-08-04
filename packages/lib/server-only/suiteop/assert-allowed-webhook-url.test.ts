import { afterEach, describe, expect, it } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { assertAllowedSuiteOpWebhookUrl } from './assert-allowed-webhook-url';

const PREVIEW_URL = 'https://suiteop-api-pr-9.up.railway.app/api/webhooks/documenso/token';

describe('assertAllowedSuiteOpWebhookUrl', () => {
  afterEach(() => {
    delete process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_HOST_SUFFIXES;
  });

  it.each([
    'https://api-us.suiteop.com/api/webhooks/documenso/token',
    'https://api-eu.suiteop.com/api/webhooks/documenso/token',
    'https://suiteop.com/api/webhooks/documenso/token',
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

  // `*.up.railway.app` is the PaaS's shared generated namespace: anyone can
  // take a subdomain on it. Accepting it by default would hand a leaked master
  // key the exact "forward this team's documents anywhere" primitive the
  // allowlist exists to deny, so preview hosts are opt-in per deployment.
  it('rejects a shared PaaS host when no extra suffix is configured', () => {
    expect(() => assertAllowedSuiteOpWebhookUrl(PREVIEW_URL)).toThrowError(
      expect.objectContaining({ code: AppErrorCode.INVALID_BODY }),
    );
  });

  it('accepts a preview host once the deployment opts into its suffix', () => {
    process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_HOST_SUFFIXES = '.up.railway.app';

    expect(assertAllowedSuiteOpWebhookUrl(PREVIEW_URL)).toBe(PREVIEW_URL);
  });

  it('still rejects an unrelated host when extra suffixes are configured', () => {
    process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_HOST_SUFFIXES = '.up.railway.app';

    expect(() => assertAllowedSuiteOpWebhookUrl('https://attacker.example.com/hook')).toThrowError(
      expect.objectContaining({ code: AppErrorCode.INVALID_BODY }),
    );
  });
});

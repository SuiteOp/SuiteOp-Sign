import { afterEach, describe, expect, it } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { assertAllowedSuiteOpWebhookUrl } from './assert-allowed-webhook-url';

const PREVIEW_HOST = 'preview-example.test';
const PREVIEW_URL = `https://${PREVIEW_HOST}/api/webhooks/documenso/token`;

describe('assertAllowedSuiteOpWebhookUrl', () => {
  afterEach(() => {
    delete process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_EXTRA_HOSTS;
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

  // A preview API is reachable only on its PaaS-generated hostname, and those
  // namespaces are shared and self-service. Accepting one by default would hand
  // a leaked master key the exact "forward this team's documents anywhere"
  // primitive the allowlist exists to deny, so it is opt-in per deployment.
  it('rejects a preview host when no extra host is configured', () => {
    expect(() => assertAllowedSuiteOpWebhookUrl(PREVIEW_URL)).toThrowError(
      expect.objectContaining({ code: AppErrorCode.INVALID_BODY }),
    );
  });

  it('accepts a preview host once the deployment opts into it', () => {
    process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_EXTRA_HOSTS = PREVIEW_HOST;

    expect(assertAllowedSuiteOpWebhookUrl(PREVIEW_URL)).toBe(PREVIEW_URL);
  });

  // Configured hosts match by equality. Were they suffixes, opting into one
  // preview host would admit every attacker-chosen prefix of it — and opting
  // into the PaaS namespace itself would admit every one of its tenants.
  it('does not admit a prefixed lookalike of a configured host', () => {
    process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_EXTRA_HOSTS = PREVIEW_HOST;

    expect(() => assertAllowedSuiteOpWebhookUrl(`https://attacker-${PREVIEW_HOST}/hook`)).toThrowError(
      expect.objectContaining({ code: AppErrorCode.INVALID_BODY }),
    );
  });

  it('still rejects an unrelated host when extra hosts are configured', () => {
    process.env.NEXT_PRIVATE_SUITEOP_WEBHOOK_EXTRA_HOSTS = PREVIEW_HOST;

    expect(() => assertAllowedSuiteOpWebhookUrl('https://attacker.example.com/hook')).toThrowError(
      expect.objectContaining({ code: AppErrorCode.INVALID_BODY }),
    );
  });
});

import { env } from '@documenso/lib/utils/env';

import { AppError, AppErrorCode } from '../../errors/app-error';

const ALLOWED_HOSTS = ['suiteop.com'];
const ALLOWED_HOST_SUFFIXES = ['.suiteop.com'];

/**
 * Extra host suffixes accepted in addition to SuiteOp's own domain, as a
 * comma-separated list — empty everywhere unless a deployment sets it.
 *
 * This exists for preview environments, whose API is reachable only on the
 * PaaS-generated hostname. Those namespaces are shared and self-service, so
 * they are configuration rather than a constant: baking one into the source
 * would let anybody who can host on the same PaaS receive a team's documents.
 */
const getExtraAllowedHostSuffixes = (): string[] =>
  (env('NEXT_PRIVATE_SUITEOP_WEBHOOK_HOST_SUFFIXES') ?? '')
    .split(',')
    .map((suffix) => suffix.trim().toLowerCase())
    .filter((suffix) => suffix.length > 0);

/**
 * Reject a SuiteOp-supplied webhook URL that is not a SuiteOp address.
 *
 * The claim exchange is master-key authenticated, so only SuiteOp itself can
 * reach this — the allowlist is a second line rather than the control. What it
 * buys is blast radius: a leaked master key still cannot turn the claim into a
 * generic "forward this team's document events anywhere" primitive, which is
 * the capability that made bearer-token `webhook.createWebhook` unsafe.
 *
 * That property only holds while every allowed host is one SuiteOp controls,
 * which is why shared PaaS namespaces live in configuration and default off.
 *
 * HTTPS only, and no embedded credentials: SuiteOp registers regional API
 * endpoints, so anything else is a misconfiguration worth failing loudly on.
 */
export const assertAllowedSuiteOpWebhookUrl = (webhookUrl: string): string => {
  let url: URL;

  try {
    url = new URL(webhookUrl);
  } catch {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Webhook URL is not a valid URL',
    });
  }

  if (url.protocol !== 'https:') {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Webhook URL must use HTTPS',
    });
  }

  if (url.username || url.password) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Webhook URL must not embed credentials',
    });
  }

  const hostname = url.hostname.toLowerCase();
  const allowedSuffixes = [...ALLOWED_HOST_SUFFIXES, ...getExtraAllowedHostSuffixes()];
  const isAllowed = ALLOWED_HOSTS.includes(hostname) || allowedSuffixes.some((suffix) => hostname.endsWith(suffix));

  if (!isAllowed) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Webhook URL must be on a SuiteOp domain',
    });
  }

  return url.toString();
};

import { AppError, AppErrorCode } from '../../errors/app-error';

const ALLOWED_HOSTS = ['suiteop.com'];
const ALLOWED_HOST_SUFFIXES = ['.suiteop.com', '.up.railway.app'];

/**
 * Reject a SuiteOp-supplied webhook URL that is not a SuiteOp address.
 *
 * The claim exchange is master-key authenticated, so only SuiteOp itself can
 * reach this — the allowlist is a second line rather than the control. What it
 * buys is blast radius: a leaked master key still cannot turn the claim into a
 * generic "forward this team's document events anywhere" primitive, which is
 * the capability that made bearer-token `webhook.createWebhook` unsafe.
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
  const isAllowed =
    ALLOWED_HOSTS.includes(hostname) || ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

  if (!isAllowed) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Webhook URL must be on a SuiteOp domain',
    });
  }

  return url.toString();
};

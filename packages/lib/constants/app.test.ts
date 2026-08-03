import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_URL = process.env.NEXT_PUBLIC_WEBAPP_URL;

/**
 * Re-imports the module with a fresh state so the once-per-process warning is
 * observable on every case.
 */
const loadWithUrl = async (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_WEBAPP_URL;
  } else {
    process.env.NEXT_PUBLIC_WEBAPP_URL = value;
  }

  vi.resetModules();

  const { NEXT_PUBLIC_WEBAPP_URL } = await import('./app');

  return NEXT_PUBLIC_WEBAPP_URL;
};

afterEach(() => {
  if (ORIGINAL_URL === undefined) {
    delete process.env.NEXT_PUBLIC_WEBAPP_URL;
  } else {
    process.env.NEXT_PUBLIC_WEBAPP_URL = ORIGINAL_URL;
  }

  vi.restoreAllMocks();
});

describe('NEXT_PUBLIC_WEBAPP_URL', () => {
  it('returns a usable absolute URL unchanged', async () => {
    for (const value of ['https://sign.example.com', 'https://sign.example.com:8443/base', 'http://localhost:3000']) {
      const read = await loadWithUrl(value);

      expect(read()).toBe(value);
    }
  });

  it('falls back to localhost when the variable is unset or empty', async () => {
    for (const value of [undefined, '']) {
      const read = await loadWithUrl(value);

      expect(read()).toBe('http://localhost:3000');
    }
  });

  it('falls back to localhost when the value has no hostname', async () => {
    // Railway resolves `https://${{RAILWAY_PUBLIC_DOMAIN}}` to a bare `https://`
    // when the service has no public domain. Without this guard the value sails
    // through `??` and throws `TypeError: Invalid URL` inside getCookieDomain()
    // at module import, crash-looping the container.
    for (const value of ['https://', 'http://', 'sign.example.com', 'not a url']) {
      const read = await loadWithUrl(value);

      expect(read()).toBe('http://localhost:3000');
    }
  });

  it('warns once when a value was set but rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const read = await loadWithUrl('https://');

    read();
    read();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('NEXT_PUBLIC_WEBAPP_URL');
  });

  it('does not warn when the variable is simply unset', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const read = await loadWithUrl(undefined);

    read();

    expect(warn).not.toHaveBeenCalled();
  });
});

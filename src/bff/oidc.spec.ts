// ── Mocks (hoisted before imports) ────────────────────────────────────────────
// openid-client is mocked so each vi.resetModules() cycle produces a fresh mock
// instance with call counts starting at 0.

vi.mock('openid-client', () => ({
  discovery: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENV_KEYS = ['OidcAuthority', 'ChurchesClientId', 'ChurchesClientSecret'];

function setValidEnv(): void {
  process.env['OidcAuthority'] = 'https://identity.example.com';
  process.env['ChurchesClientId'] = 'churches-client';
  process.env['ChurchesClientSecret'] = 'client-secret';
}

function clearEnv(): void {
  ENV_KEYS.forEach(k => delete process.env[k]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
// Each test calls vi.resetModules() via a shared beforeEach and receives fresh
// module instances.  Dynamic imports are used to get the post-reset versions.

describe('getOidcConfig', () => {
  // Per-test references to the fresh mock instances.
  let getOidcConfig: () => Promise<unknown>;
  let discoveryMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    clearEnv();
    vi.clearAllMocks();
    vi.resetModules();

    // Import openid-client first so it is cached when oidc.ts loads it as a
    // static import.
    const oidcClientModule = await import('openid-client');
    discoveryMock = vi.mocked(oidcClientModule.discovery);

    const oidcModule = await import('./oidc');
    getOidcConfig = oidcModule.getOidcConfig;
  });

  afterEach(() => clearEnv());

  it('calls discovery with the configured authority, client id, and secret', async () => {
    setValidEnv();
    discoveryMock.mockResolvedValue({ issuer: 'https://identity.example.com' });

    await getOidcConfig();

    expect(discoveryMock).toHaveBeenCalledWith(
      new URL('https://identity.example.com'),
      'churches-client',
      'client-secret',
    );
  });

  it('returns the value produced by discovery', async () => {
    setValidEnv();
    const fakeConfig = { issuer: 'https://identity.example.com' };
    discoveryMock.mockResolvedValue(fakeConfig);

    const result = await getOidcConfig();

    expect(result).toBe(fakeConfig);
  });

  it('returns the cached config on subsequent calls without calling discovery again', async () => {
    setValidEnv();
    discoveryMock.mockResolvedValue({ issuer: 'cached' });

    const first = await getOidcConfig();
    const second = await getOidcConfig();

    expect(discoveryMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('throws when OidcAuthority is missing', async () => {
    process.env['ChurchesClientId'] = 'id';
    process.env['ChurchesClientSecret'] = 'secret';
    discoveryMock.mockResolvedValue({});

    await expect(getOidcConfig()).rejects.toThrow('OidcAuthority');
  });

  it('throws when ChurchesClientId is missing', async () => {
    process.env['OidcAuthority'] = 'https://identity.example.com';
    process.env['ChurchesClientSecret'] = 'secret';
    discoveryMock.mockResolvedValue({});

    await expect(getOidcConfig()).rejects.toThrow('ChurchesClientId');
  });

  it('throws when ChurchesClientSecret is missing', async () => {
    process.env['OidcAuthority'] = 'https://identity.example.com';
    process.env['ChurchesClientId'] = 'id';
    discoveryMock.mockResolvedValue({});

    await expect(getOidcConfig()).rejects.toThrow('ChurchesClientSecret');
  });
});

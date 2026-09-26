import { newHttpsAddress, newText } from '@crgolden/modules/testing';
import { BffSettingKeys, InvalidSettingError } from './settings';

vi.mock('openid-client', () => ({
  discovery: vi.fn(),
}));

const ENV_KEYS = [BffSettingKeys.OidcAuthority, BffSettingKeys.ClientId, BffSettingKeys.ClientSecret];

const VALID_SETTINGS = {
  authority: newHttpsAddress(),
  clientId: newText(),
  clientSecret: newText(),
};

function setValidEnv(): void {
  process.env[BffSettingKeys.OidcAuthority] = VALID_SETTINGS.authority;
  process.env[BffSettingKeys.ClientId] = VALID_SETTINGS.clientId;
  process.env[BffSettingKeys.ClientSecret] = VALID_SETTINGS.clientSecret;
}

function clearEnv(): void {
  ENV_KEYS.forEach(k => delete process.env[k]);
}

describe('getOidcConfig', () => {
  let getOidcConfig: () => Promise<unknown>;
  let discoveryMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    clearEnv();
    vi.clearAllMocks();
    vi.resetModules();

    const oidcClientModule = await import('openid-client');
    discoveryMock = vi.mocked(oidcClientModule.discovery);

    const oidcModule = await import('./oidc');
    getOidcConfig = oidcModule.getOidcConfig;
  });

  afterEach(() => clearEnv());

  it('calls discovery with the configured authority, client id, and secret', async () => {
    setValidEnv();
    discoveryMock.mockResolvedValue({ issuer: VALID_SETTINGS.authority });

    await getOidcConfig();

    expect(discoveryMock).toHaveBeenCalledWith(
      new URL(VALID_SETTINGS.authority),
      VALID_SETTINGS.clientId,
      VALID_SETTINGS.clientSecret,
    );
  });

  it('returns the value produced by discovery', async () => {
    setValidEnv();
    const fakeConfig = { issuer: VALID_SETTINGS.authority };
    discoveryMock.mockResolvedValue(fakeConfig);

    const result = await getOidcConfig();

    expect(result).toBe(fakeConfig);
  });

  it('returns the cached config on subsequent calls without calling discovery again', async () => {
    setValidEnv();
    discoveryMock.mockResolvedValue({ issuer: newText() });

    const first = await getOidcConfig();
    const second = await getOidcConfig();

    expect(discoveryMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it.each(ENV_KEYS)('throws naming %s when it is missing', async missing => {
    setValidEnv();
    delete process.env[missing];
    discoveryMock.mockResolvedValue({});

    await expect(getOidcConfig()).rejects.toThrow(new InvalidSettingError(missing));
    expect(discoveryMock).not.toHaveBeenCalled();
  });
});

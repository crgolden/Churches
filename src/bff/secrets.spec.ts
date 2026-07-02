// ── Mocks (hoisted before imports) ────────────────────────────────────────────
// All variables referenced inside vi.mock factories must be declared INSIDE the
// factory (hoisting means they would be accessed before initialization otherwise).

vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: vi.fn(),
}));

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}));

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { loadKeyVaultSecrets } from './secrets';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadKeyVaultSecrets', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = ['KeyVaultUri', 'ChurchesClientId', 'ChurchesClientSecret'];

  let mockGetSecret: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ENV_KEYS.forEach(k => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });

    mockGetSecret = vi.fn().mockResolvedValue({ value: undefined });
    // Vitest 4.x requires a `class` or `function` keyword in mockImplementation
    // when the mock is called via `new`; arrow functions are not constructable.
    vi.mocked(SecretClient).mockImplementation(
      class {
        getSecret: typeof mockGetSecret;
        constructor() {
          this.getSecret = mockGetSecret;
        }
      } as never,
    );
    vi.mocked(DefaultAzureCredential).mockImplementation(class {} as never);
  });

  afterEach(() => {
    ENV_KEYS.forEach(k => {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    });
  });

  it('is a no-op when KeyVaultUri is not set', async () => {
    await loadKeyVaultSecrets();

    expect(SecretClient).not.toHaveBeenCalled();
    expect(DefaultAzureCredential).not.toHaveBeenCalled();
  });

  it('creates a SecretClient with the KeyVaultUri and a DefaultAzureCredential', async () => {
    process.env['KeyVaultUri'] = 'https://my-vault.vault.azure.net';

    await loadKeyVaultSecrets();

    expect(DefaultAzureCredential).toHaveBeenCalledOnce();
    expect(SecretClient).toHaveBeenCalledWith(
      'https://my-vault.vault.azure.net',
      expect.any(Object),
    );
  });

  it('fetches ChurchesClientId and ChurchesClientSecret and writes them into process.env', async () => {
    process.env['KeyVaultUri'] = 'https://my-vault.vault.azure.net';
    mockGetSecret
      .mockResolvedValueOnce({ value: 'fetched-client-id' })
      .mockResolvedValueOnce({ value: 'fetched-client-secret' });

    await loadKeyVaultSecrets();

    expect(mockGetSecret).toHaveBeenCalledWith('ChurchesClientId');
    expect(mockGetSecret).toHaveBeenCalledWith('ChurchesClientSecret');
    expect(process.env['ChurchesClientId']).toBe('fetched-client-id');
    expect(process.env['ChurchesClientSecret']).toBe('fetched-client-secret');
  });

  it('does not overwrite process.env entries when the secret value is undefined', async () => {
    process.env['KeyVaultUri'] = 'https://my-vault.vault.azure.net';
    process.env['ChurchesClientId'] = 'existing-id';
    mockGetSecret.mockResolvedValue({ value: undefined });

    await loadKeyVaultSecrets();

    expect(process.env['ChurchesClientId']).toBe('existing-id');
  });
});

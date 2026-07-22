import {
  discovery,
  type Configuration,
} from 'openid-client';

let _config: Configuration | null = null;

/**
 * Lazily initialises (and caches) the openid-client Configuration via
 * Authorization Server Metadata discovery.
 *
 * Every value below arrives as a plain environment variable. In production the
 * client id and secret are App Service settings declared as
 * `@Microsoft.KeyVault(SecretUri=...)` references, which the platform resolves
 * from Key Vault at startup using the app's managed identity — so this code
 * never talks to Key Vault itself.
 */
export async function getOidcConfig(): Promise<Configuration> {
  if (_config !== null) {
    return _config;
  }

  const authority = process.env['OidcAuthority'];
  const clientId = process.env['ChurchesClientId'];
  const clientSecret = process.env['ChurchesClientSecret'];

  if (!authority) {
    throw new Error('Missing required environment variable: OidcAuthority');
  }
  if (!clientId) {
    throw new Error('Missing required environment variable: ChurchesClientId');
  }
  if (!clientSecret) {
    throw new Error('Missing required environment variable: ChurchesClientSecret');
  }

  // discovery(server, clientId, clientSecret) — the third-argument string
  // shorthand sets client_secret and defaults to ClientSecretPost.
  _config = await discovery(new URL(authority), clientId, clientSecret);

  return _config;
}

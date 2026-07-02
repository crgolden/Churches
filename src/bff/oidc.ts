import {
  discovery,
  type Configuration,
} from 'openid-client';
import { loadKeyVaultSecrets } from './secrets';

let _config: Configuration | null = null;
let _secretsLoaded = false;

/**
 * Lazily initialises (and caches) the openid-client Configuration via
 * Authorization Server Metadata discovery.  Key Vault secrets are loaded
 * once on first call so that the server can start without blocking on Azure.
 */
export async function getOidcConfig(): Promise<Configuration> {
  if (_config !== null) {
    return _config;
  }

  if (!_secretsLoaded) {
    await loadKeyVaultSecrets();
    _secretsLoaded = true;
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

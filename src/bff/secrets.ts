import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

/**
 * In production (when KeyVaultUri is set), loads ChurchesClientId and
 * ChurchesClientSecret from Azure Key Vault and writes them into
 * process.env so the rest of the BFF can read them uniformly.
 *
 * In development the secrets are expected to already be present as
 * environment variables (App Service settings / local .env / launch profile).
 */
export async function loadKeyVaultSecrets(): Promise<void> {
  const keyVaultUri = process.env['KeyVaultUri'];
  if (!keyVaultUri) {
    // Development: secrets come directly from environment variables.
    return;
  }

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(keyVaultUri, credential);

  const [clientIdSecret, clientSecretSecret] = await Promise.all([
    client.getSecret('ChurchesClientId'),
    client.getSecret('ChurchesClientSecret'),
  ]);

  if (clientIdSecret.value) {
    process.env['ChurchesClientId'] = clientIdSecret.value;
  }

  if (clientSecretSecret.value) {
    process.env['ChurchesClientSecret'] = clientSecretSecret.value;
  }
}

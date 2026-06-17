namespace Churches.Server.Extensions;

using Azure.Security.KeyVault.Secrets;

public static class SecretClientExtensions
{
    extension(SecretClient secretClient)
    {
#pragma warning disable SA1009
        public (
            KeyVaultSecret ElasticsearchUsername,
            KeyVaultSecret ElasticsearchPassword,
            KeyVaultSecret ChurchesClientId,
            KeyVaultSecret ChurchesClientSecret
        ) GetChurchesSecrets()
        {
            var elasticsearchUsername = secretClient.GetSecret("ElasticsearchUsername");
            var elasticsearchPassword = secretClient.GetSecret("ElasticsearchPassword");
            var churchesClientId = secretClient.GetSecret("ChurchesClientId");
            var churchesClientSecret = secretClient.GetSecret("ChurchesClientSecret");
            return (
                elasticsearchUsername.Value,
                elasticsearchPassword.Value,
                churchesClientId.Value,
                churchesClientSecret.Value
            );
        }
#pragma warning restore SA1009
    }
}

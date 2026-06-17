namespace Churches.Server.Extensions;

public static class ConfigurationExtensions
{
    extension(IConfiguration configuration)
    {
        public T GetRequired<T>(string key)
            where T : notnull
        {
            return configuration.GetValue<T?>(key) ?? throw new InvalidOperationException($"Invalid '{key}'.");
        }

#pragma warning disable SA1009
        internal (
            string ChurchesClientId,
            string ChurchesClientSecret
        ) GetChurchesSecrets()
        {
            var churchesClientId = configuration.GetRequired<string>("ChurchesClientId");
            var churchesClientSecret = configuration.GetRequired<string>("ChurchesClientSecret");
            return (
                churchesClientId,
                churchesClientSecret
            );
        }
#pragma warning restore SA1009
    }
}

namespace Churches.Tests.Extensions;

using Churches.Server.Extensions;
using Microsoft.Extensions.Configuration;

[Trait("Category", "Unit")]
public sealed class ConfigurationExtensionsTests
{
    [Fact]
    public void GetRequired_ReturnsValue_WhenKeyExists()
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Foo"] = "bar" })
            .Build();

        Assert.Equal("bar", config.GetRequired<string>("Foo"));
    }

    [Fact]
    public void GetRequired_ThrowsInvalidOperationExceptionWithKeyName_WhenKeyMissing()
    {
        IConfiguration config = new ConfigurationBuilder().Build();

        var ex = Assert.Throws<InvalidOperationException>(() => config.GetRequired<string>("Missing"));
        Assert.Equal("Invalid 'Missing'.", ex.Message);
    }

    [Fact]
    public void GetChurchesSecrets_ReturnsClientIdAndSecret()
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ChurchesClientId"] = "test-client-id",
                ["ChurchesClientSecret"] = "test-client-secret",
            })
            .Build();

        var (clientId, clientSecret) = config.GetChurchesSecrets();

        Assert.Equal("test-client-id", clientId);
        Assert.Equal("test-client-secret", clientSecret);
    }

    [Fact]
    public void GetChurchesSecrets_ThrowsWhenClientIdMissing()
    {
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ChurchesClientSecret"] = "s" })
            .Build();

        Assert.Throws<InvalidOperationException>(() => config.GetChurchesSecrets());
    }
}

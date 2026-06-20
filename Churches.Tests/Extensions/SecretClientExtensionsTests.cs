namespace Churches.Tests.Extensions;

using Azure;
using Azure.Security.KeyVault.Secrets;
using Churches.Server.Extensions;
using Moq;

[Trait("Category", "Unit")]
public sealed class SecretClientExtensionsTests
{
    [Fact]
    public void GetChurchesSecrets_ReturnsAllFourSecrets()
    {
        var client = BuildMock().Object;

        var (elasticsearchUsername, elasticsearchPassword, churchesClientId, churchesClientSecret) =
            client.GetChurchesSecrets();

        Assert.Equal("ElasticsearchUsername", elasticsearchUsername.Name);
        Assert.Equal("ElasticsearchPassword", elasticsearchPassword.Name);
        Assert.Equal("ChurchesClientId", churchesClientId.Name);
        Assert.Equal("ChurchesClientSecret", churchesClientSecret.Name);
    }

    [Fact]
    public void GetChurchesSecrets_ReturnsValuesFromVault()
    {
        var client = BuildMock().Object;

        var (elasticsearchUsername, _, _, _) = client.GetChurchesSecrets();

        Assert.Equal("ElasticsearchUsername-value", elasticsearchUsername.Value);
    }

    private static Mock<SecretClient> BuildMock()
    {
        var mock = new Mock<SecretClient>();
        mock.Setup(c => c.GetSecret(
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<SecretContentType?>(),
                It.IsAny<CancellationToken>()))
            .Returns<string, string?, SecretContentType?, CancellationToken>(
                (name, _, _, _) => Response.FromValue(new KeyVaultSecret(name, $"{name}-value"), Mock.Of<Response>()));
        return mock;
    }
}

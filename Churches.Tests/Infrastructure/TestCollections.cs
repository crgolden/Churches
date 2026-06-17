namespace Churches.Tests.Infrastructure;

[CollectionDefinition(Name)]
public sealed class E2ECollection : ICollectionFixture<ChurchesFixture>
{
    public const string Name = "E2E";
}

[CollectionDefinition(Name)]
public sealed class SmokeCollection : ICollectionFixture<ChurchesFixture>
{
    public const string Name = "Smoke";
}

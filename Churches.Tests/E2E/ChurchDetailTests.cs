namespace Churches.Tests.E2E;

using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class ChurchDetailTests
{
    private readonly ChurchesFixture _fixture;

    public ChurchDetailTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task ChurchDetail_WithFullData_RendersAllFields()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-name")).ToContainTextAsync("First Baptist Church Austin");
            await Assertions.Expect(page.Locator("#church-address")).ToContainTextAsync("901 Trinity St");
            await Assertions.Expect(page.Locator("#church-address")).ToContainTextAsync("Austin, TX 78701");
            await Assertions.Expect(page.Locator("#church-phone")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-website")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-email")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-worship-style")).ToHaveTextAsync("Traditional");
            await Assertions.Expect(page.Locator("#church-language")).ToHaveTextAsync("English");
            await Assertions.Expect(page.Locator("#church-wheelchair")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ChurchDetail_WithSparseData_OmitsNullFields()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/mosaic-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-name")).ToContainTextAsync("Mosaic Church Austin");
            await Assertions.Expect(page.Locator("#church-phone")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-website")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-wheelchair")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchDetail_WithInvalidSlug_ShowsNotFoundMessage()
    {
        _fixture.ChurchStore.Clear();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/this-slug-does-not-exist");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-error")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ChurchDetail_WhenAnonymous_HidesContributeLink()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#contribute-link")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchDetail_WhenAuthenticated_ShowsContributeLink()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#contribute-link")).ToBeVisibleAsync();
        }
    }
}

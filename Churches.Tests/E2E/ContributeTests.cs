namespace Churches.Tests.E2E;

using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class ContributeTests
{
    private readonly ChurchesFixture _fixture;

    public ContributeTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task CorrectionForm_OnLoad_ShowsExpectedFields()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Suggest a Correction");
            await Assertions.Expect(page.Locator("text=First Baptist Church Austin")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("select")).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Textbox)).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Submit Correction" })).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task CorrectionForm_FieldSelector_DefaultsToCanonicalName()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            var select = page.Locator("select");
            var selectedOption = await select.InputValueAsync();
            Assert.Equal("canonicalName", selectedOption);
        }
    }

    [Fact]
    public async Task CorrectionForm_WithValidInput_ShowsSuccessMessage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await page.Locator("select").SelectOptionAsync("street");
            await page.GetByRole(AriaRole.Textbox).FillAsync("123 New Street");
            await page.GetByRole(AriaRole.Button, new() { Name = "Submit Correction" }).ClickAsync();
            await Assertions.Expect(page.Locator("text=submitted for review")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task CorrectionForm_WithEmptyNewValue_PreventsSubmission()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await page.GetByRole(AriaRole.Button, new() { Name = "Submit Correction" }).ClickAsync();
            await Assertions.Expect(page.Locator("text=submitted for review")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Suggest a Correction");
        }
    }

    [Fact]
    public async Task ContributePage_WhenUnauthenticated_RedirectsToLogin()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await page.WaitForURLAsync("**/bff/login**", new PageWaitForURLOptions { Timeout = 10_000 });
            Assert.Contains("/bff/login", page.Url, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task ContributePage_WithInvalidSlug_RedirectsToHome()
    {
        _fixture.ChurchStore.Clear();

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/this-slug-does-not-exist");
        await using (ctx)
        {
            await page.WaitForFunctionAsync("() => window.location.pathname === '/'", null, new PageWaitForFunctionOptions { Timeout = 10_000 });
            Assert.Equal("/", new Uri(page.Url).AbsolutePath);
        }
    }
}
